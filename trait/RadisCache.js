const redis = require("redis");
const client = redis.createClient({
  socket: {
    host: "127.0.0.1",
    port: "6379",
  },
  username: null,
  password: null,
});
async function getRediesValue(key) {
  await client.connect();
  let rediesKey = await client.get(key);
  await client.disconnect();
  return rediesKey;
}
async function setRediesValue(key, val, expTime) {
  await client.connect();
  await client.set(key, val, "EX", expTime);
  await client.disconnect();
  return;
}
module.exports = {
  getRediesValue,
  setRediesValue,
};
