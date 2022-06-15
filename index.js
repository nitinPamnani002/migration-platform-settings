const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const NodeCouchDb = require('./nodeCouchDb');
const logger = require('./logger')
const routes = require("./routes");
const config = require("./config/config.json")
require('dotenv').config();

const couch = new NodeCouchDb({
    host: config.COUCH.host,
    protocol: config.COUCH.protocol,
    port: config.COUCH.port,
    auth: {
        user: config.COUCH.auth.user,
        password: config.COUCH.auth.password
    }
});



const app = express();

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.get('/', function(req, res) {
    res.send("Working");
} )

async function triggerMigration(couch, logger) {
  //await routes.fetchDocs(couch, logger);
  await routes.updateTargetDoc(couch, logger);
}
app.post('/startMigration', async function(req, res) {
   await triggerMigration(couch, logger);
   res.send("Started the migration, find the updated results in the logger file - migration.log")
})

app.listen(config.APP_CONFIG.MIGRATION_PORT, () => {
    console.log(`listening on port ${config.APP_CONFIG.MIGRATION_PORT}`)
})

