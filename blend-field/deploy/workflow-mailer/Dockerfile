FROM python:3.13-alpine
RUN apk add --no-cache postgresql-client && adduser -D -u 1001 mailer
WORKDIR /app
COPY mailer.py .
USER mailer
ENTRYPOINT ["python", "-u", "/app/mailer.py"]
