const fs = require('fs');
const pool = require('../sqlConnection.js')
const dbName = "white_labeling_data"
const viewUrl = "_all_docs"
const config = require("../config/config.json")

module.exports = {
    fetchDocs: async(couch, logger)=> {
      couch.get(dbName, viewUrl).then( async function(data, headers, status) {
          
        const idMap = data.data.rows;
        const uniqueKeys = new Set();
        const count = 0;
        for(const idM of idMap) {
          if(!uniqueKeys.has(idM.id)) {
            uniqueKeys.add(idM.id);
            const doc = await couch.get(dbName, idM.id)
            if(typeof doc.data.companyId !== "undefined") {
              fs.writeFile("sourceDocs/"+doc.data.companyId+".json", JSON.stringify(doc.data), async function(err) {
                if(err) {
                  logger.error("Issue while writing the doc");
                  throw err;
                }
                count++;
                if(count == config.APP_CONFIG.BATCH_SIZE) {
                  await batchProcess(couch, logger);
                }
             })
            } 
          }   
        }
        if( count > 0) {
          await batchProcess(couch, logger);
        }
        console.log(uniqueKeys.size);
        },
        function(err){
          logger.error(err);
          return err;
        })
      }
    }

async function batchProcess(couch, logger) {
    /**
     * keeping the batch size as 10,
     * Fetch 10 file names from the sourceDocs 
     *  i. collect kyb status for those 10
     *  ii. if kyb approved, move the docs to successfulDocs folder
     *  iii. if not then, move the docs to targetDocs folder with payment settings turned off.
     * 
     */
    fs.readdir('./sourceDocs', async (err, files)=> {
      let count = 0;
        
      let companyIds = []     
      for(const file of files) {
        const [filename, fileExt] = file.split(".");
               
        if( fileExt == "json") {
          companyIds.push(filename);
          count++;
        }
            
        if(count == config.APP_CONFIG.BATCH_SIZE) {
          processFilesInBatch(companyIds, count, logger);
          companyIds = [];
          count = 0;
        }
     }

     if(count > 0 && companyIds) {
      processFilesInBatch(companyIds, count, logger);
     }
    })
    await updateTargetDoc(couch, logger);
}

async function updateTargetDoc(couch, logger) {
  fs.readdir("./targetDocs",async function(err, files) {
        
  for (const file of files ) {
    const [filename, fileExt] = file.split(".");
    
    if(fileExt == "json") {
      fs.readFile( "targetDocs/"+file, "utf-8", async function(err, data) {
                    
      if(!err) {
        let doc = JSON.parse(data);
        const docId = doc._id;

        couch.updateFunction(dbName, "getDoc","docUpdate", doc, docId).then(({data, headers, status})=>{
          console.log(data, status)

          fs.unlink( "targetDocs/"+file, async function(err) {
            if(err) {
              logger.info("Updated the doc for co id: "+filename+ " but could not move it from targetDocs directory")
            } else {
              fs.writeFile( "successfulDocs/"+file, JSON.stringify(doc), async function(err) {
                if(err) {
                  logger.error("Unable to move the doc for co id: "+ filename+ " to successfulDocs");
                }
              })
            }
          })
        }, err => {
          console.log(err);
        })
      }
     })
    }
   }
  })        
}


async function processFilesInBatch(companyIds, count, logger) {
    let paramString='';
    let kybSQL = `SELECT e2_client_id, kyb_status FROM clientele WHERE e2_client_id IN (`;
    
    for(let iter = 0; iter < count; iter++) {
      if( iter  == count -1) {
        paramString += "?"
      } else   
          paramString += "?,"
    }
    kybSQL += " "+paramString+")";
    console.log("Check this query it",kybSQL)

    let isKyb = await getSqlResponse(companyIds, kybSQL);
    console.log(companyIds)
    console.log(isKyb)
    
    if (isKyb && Array.isArray(isKyb) && isKyb.length > 0) {
      for(const eachClientData of isKyb) {
        const docToUpdate = eachClientData.e2_client_id+".json";

        if(eachClientData.kyb_status != 2) {                         
         fs.readFile( "sourceDocs/"+docToUpdate, "utf-8", async function (err, data) {
          //data contains the doc
          const doc = JSON.parse(data);
          
          if(doc.paymentMethodAccess && doc.paymentMethodAccess.payu) {
            doc.paymentMethodAccess.payu = 0;
          }

         fs.unlink("sourceDocs/"+docToUpdate ,async function(err) {
           if(!err) {
             fs.writeFile("targetDocs/"+docToUpdate, JSON.stringify(doc), async function(err) {
               if(err) {
                 logger.errror("Could not create target doc for co. id "+docToUpdate.split(".")[0])
               }
              })
            }
         }) 

        })
        } else {
          fs.unlink("sourceDocs/"+docToUpdate, async function(err) {
            if(err) {
              logger.error("Unable to ignore the doc for company id - "+docToUpdate.split(".")[0]+" "+err);
            } else {
              logger.debug("Ignoring the company id - "+docToUpdate.split(".")[0]+" as kyb approved");
            }
          })
        }
      }
    } else {
        logger.info("No data found for batch containg company ids "+companyIds)
    }
}


async function getSqlResponse(query_params, query){

    return new Promise(function(resolve, reject){
      pool.getConnection(function(err, connection) {
        if (err || !connection) {
          if (connection) connection.release();
            console.info(err)
            return false
        } 
        
        connection.query(query,query_params, function (err, result) {

          if (connection) connection.release();
          if(err){
            console.log(err)
            resolve(err)
          }else{
            resolve(result)
          }

        })

    })

    }.bind(this)).catch( function(reason){
        // Log the rejection reason
            logger.info('Handle rejected promise ('+reason+') here.');
            logger.info(reason);
            return false;
    })  
  }

  module.exports.updateTargetDoc = updateTargetDoc