import json
import os
import smtplib
import ssl
import subprocess
import sys
import time
from email.message import EmailMessage
from email.utils import formataddr
from html import escape
from uuid import UUID


def query(statement):
    result = subprocess.run(
        ["psql", "-XqAt", "-v", "ON_ERROR_STOP=1", "-c", statement],
        capture_output=True, text=True, timeout=20,
    )
    if result.returncode:
        raise RuntimeError("Workflow database request failed")
    return result.stdout.strip()


def open_smtp():
    return smtplib.SMTP_SSL(
        os.environ["SMTP_HOST"], int(os.environ["SMTP_PORT"]),
        timeout=20, context=ssl.create_default_context(),
    )


def job_summary(delivery):
    starts = delivery["starts_sast"]
    ends = delivery["ends_sast"]
    appointment = "Not scheduled"
    if starts:
        if ends and starts.split(",")[0] == ends.split(",")[0]:
            appointment = f"{starts} to {ends.split(', ', 1)[1]} SAST"
        elif ends:
            appointment = f"{starts} to {ends} SAST"
        else:
            appointment = f"{starts} SAST"
    return [
        ("Job number", f"#{delivery['number']}"),
        ("Job title", delivery["title"]),
        ("Property / unit", delivery["property"]),
        ("Trade", delivery["trade"] or "To be confirmed"),
        ("Current status", delivery["status"]),
        ("Appointment", appointment),
    ]


def build_message(delivery):
    address = os.environ["SMTP_FROM"]
    tenant = delivery["audience"] == "tenant"
    link = os.environ["TENANT_PORTAL_URL"] if tenant else os.environ["CONTRACTOR_PORTAL_URL"]
    button = "Open tenant portal" if tenant else "Open contractor portal"
    fields = job_summary(delivery)
    summary = delivery["message"]
    plain_details = "\n".join(f"{label}: {value or '—'}" for label, value in fields)
    rows = "".join(
        f'<tr><th scope="row" align="left" valign="top" width="33%" style="border-bottom:1px solid #e4e7eb;'
        f'padding:11px 14px;background:#f4f6f8;color:#43515d;font-size:14px;">{escape(label)}</th>'
        f'<td valign="top" style="border-bottom:1px solid #e4e7eb;padding:11px 14px;'
        f'color:#1b2933;font-size:14px;word-break:break-word;">{escape(value or "—")}</td></tr>'
        for label, value in fields
    )
    message = EmailMessage()
    message["From"] = formataddr(("Blend Job Cards", address))
    message["To"] = delivery["email"]
    message["Subject"] = f"Blend Job Cards #{delivery['number']}"
    message["Message-ID"] = f"<workflow-{UUID(delivery['id'])}@{address.rsplit('@', 1)[1]}>"
    message.set_content(f"{summary}\n\n{plain_details}\n\n{button}: {link}\n")
    message.add_alternative(f"""<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f4f5;font-family:Arial,Helvetica,sans-serif;color:#1b2933;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f1f4f5">
<tr><td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#ffffff"
       style="max-width:600px;border:1px solid #dfe5e7;">
<tr><td bgcolor="#122d35" style="padding:18px 24px;color:#ffffff;font-size:18px;font-weight:bold;">Blend Job Cards</td></tr>
<tr><td style="padding:24px;">
<h1 style="margin:0 0 8px;font-size:24px;line-height:1.3;color:#122d35;">Job update</h1>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5;">{escape(summary)}</p>
<table aria-label="Job details" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e4e7eb;">
{rows}
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
<tr><td bgcolor="#006254" style="mso-padding-alt:12px 18px;">
<a href="{escape(link, quote=True)}" style="display:inline-block;padding:12px 18px;color:#ffffff;
text-decoration:none;font-size:15px;font-weight:bold;">{button}</a>
</td></tr></table>
<p style="margin:16px 0 0;color:#43515d;font-size:13px;line-height:1.5;">Sign in to view the full job.</p>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>""", subtype="html")
    return message


def send(delivery):
    message = build_message(delivery)
    sending = False
    try:
        smtp = open_smtp()
        try:
            smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
            sending = True
            smtp.send_message(message)
        finally:
            smtp.close()
        return "accepted", "Accepted by mail server"
    except smtplib.SMTPRecipientsRefused as error:
        code = next(iter(error.recipients.values()))[0]
        return ("retry" if 400 <= code < 500 else "failed"), f"Recipient SMTP {code}"
    except smtplib.SMTPResponseException as error:
        code = error.smtp_code
        return ("retry" if 400 <= code < 500 else "failed"), f"SMTP {code}"
    except (OSError, smtplib.SMTPException):
        if sending:
            return "uncertain", "Connection interrupted during send"
        return "retry", "Could not establish authenticated mail connection"


def process_one():
    row = query("select row_to_json(delivery) from public.claim_workflow_email_summary() delivery")
    if not row:
        return False
    delivery = json.loads(row)
    if delivery["email"]:
        outcome, detail = send(delivery)
        delivery_id = UUID(delivery["id"])
        attempt = int(delivery["attempt"])
        query(f"select public.finish_workflow_email('{delivery_id}', {attempt}, '{outcome}', '{detail}')")
        print(f"Workflow email {delivery_id} {outcome}")
    return True


if __name__ == "__main__":
    if sys.argv[1:] == ["--check"]:
        if query("select has_function_privilege('public.claim_workflow_email_summary()', 'EXECUTE')") != "t":
            raise SystemExit("Workflow summary permission check failed")
        with open_smtp() as smtp:
            smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
            if smtp.noop()[0] != 250:
                raise SystemExit("SMTP health check failed")
        print("Workflow database and authenticated SMTP connection verified.")
        sys.exit()
    while True:
        try:
            time.sleep(1 if process_one() else 5)
        except (RuntimeError, OSError, ValueError, subprocess.TimeoutExpired):
            # Client and SMTP exceptions can contain private addresses or credentials.
            print("Workflow email worker could not process a delivery")
            time.sleep(10)
