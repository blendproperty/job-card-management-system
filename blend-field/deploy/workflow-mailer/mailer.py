import json
import os
import smtplib
import ssl
import subprocess
import sys
import time
from email.message import EmailMessage
from email.utils import formataddr
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


def send(delivery):
    address = os.environ["SMTP_FROM"]
    link = os.environ["TENANT_PORTAL_URL"] if delivery["audience"] == "tenant" else os.environ["CONTRACTOR_PORTAL_URL"]
    message = EmailMessage()
    message["From"] = formataddr(("Blend Job Cards", address))
    message["To"] = delivery["email"]
    message["Subject"] = f"Blend Job Cards #{delivery['number']}"
    message["Message-ID"] = f"<workflow-{UUID(delivery['id'])}@{address.rsplit('@', 1)[1]}>"
    message.set_content(f"{delivery['message']}.\n\nSign in to view the job:\n{link}\n")
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
    row = query("select row_to_json(delivery) from public.claim_workflow_email() delivery")
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
        query("select current_user")
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
