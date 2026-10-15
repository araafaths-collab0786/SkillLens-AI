// MongoDB init script — runs once when the container is first created.
// Creates the application user and empty collections.
db = db.getSiblingDB("skilllens");
db.createUser({
  user: "app",
  pwd: process.env.MONGO_APP_PASSWORD || "changeme_in_env",
  roles: [{ role: "readWrite", db: "skilllens" }],
});
db.createCollection("users");
db.createCollection("resumes");
db.createCollection("jobs");
db.createCollection("matches");
db.createCollection("refresh_tokens");
