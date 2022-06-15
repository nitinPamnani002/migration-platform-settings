let mysql = require('mysql')
const config = require("./config/config.json")

var conn = mysql.createPool({
	connectionLimit: config.OPENCART_DB.connectionLimit,
	host: config.OPENCART_DB.host,
	user: config.OPENCART_DB.user,
	password: config.OPENCART_DB.password,
	database: config.OPENCART_DB.database,
	debug    :  config.OPENCART_DB.debug,
	queueLimit: config.OPENCART_DB.queueLimit,
	acquireTimeout: config.OPENCART_DB.acquireTimeout
});

module.exports = conn;