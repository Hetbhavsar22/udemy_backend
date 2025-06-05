const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const Rediscache = require("./RadisCache");
const client = new SecretManagerServiceClient();
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APP_CRED;
async function getSecretValue(secretNames) {
  const secretValues = {};
  for (const secretName of secretNames) {
    let secretExist = await Rediscache.getRediesValue(secretName);
    if (secretExist) {
      secretValues[secretName] = secretExist;
    } else {
      const secretPath = `projects/majestic-garbh-sanskar/secrets/${secretName}/versions/latest`;
      try {
        const [version] = await client.accessSecretVersion({
          name: secretPath,
        });
        const secretValue = version.payload.data.toString("utf8");
        secretValues[secretName] = secretValue;
        await Rediscache.setRediesValue(secretName, secretValue, 3600);
      } catch (err) {
        console.error(
          `Error reading ${secretName} from Secret Manager:`,
          err.message
        );
      }
    }
  }
  return secretValues;
}
module.exports = {
  getSecretValue,
};
