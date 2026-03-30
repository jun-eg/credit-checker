FROM amazon/aws-cli:latest
COPY fetch-secrets.sh /fetch-secrets.sh
RUN chmod +x /fetch-secrets.sh
ENTRYPOINT ["/fetch-secrets.sh"]
