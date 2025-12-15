# Vault Agent Configuration for AWS App Runner
# Uses AWS IAM authentication method

pid_file = "/tmp/vault-agent.pid"

vault {
  address = "${VAULT_ADDR}"
}

auto_auth {
  method "aws" {
    mount_path = "auth/aws"
    config = {
      type = "iam"
      role = "${VAULT_ROLE}"
    }
  }

  sink "file" {
    config = {
      path = "/tmp/vault-token"
    }
  }
}

template {
  source      = "/app/vault/env.ctmpl"
  destination = "/etc/nodeapp/.env.generated"
  error_on_missing_key = true
  command = "bash -c 'set -a && source /etc/nodeapp/.env.generated && set +a && pm2 restart /app/ecosystem.config.js --update-env'"
}

# Keep running and watch for secret changes
exit_after_auth = false
template_config {
  exit_on_retry_failure = true
  static_secret_render_interval = "1m"
}
