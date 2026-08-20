import https from 'https';

function resolveRedirect(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(res.headers.location);
      } else {
        resolve(`Not redirected (Status: ${res.statusCode})`);
      }
    }).on('error', (err) => {
      resolve(`Error: ${err.message}`);
    });
  });
}

async function run() {
  const d1 = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFXxcaLW9-zPSpo6Z8F6E7L5cDo61wcvBEmarYcQYubtmbhXnTAuqg7e78jpNL0GpBNhTIOimKV0U4FKdBTLfCFe2PDUW9RZdfArd9Y8bTLCJBRXg-ReTTIrION1j07b4g_Efm4jiS3c8VfigwNDDvD-uy2wUbinqNb3FWpuvGXUaDC3y_7FUsY6MNO2ulCV4iJ0ReRBqY=';
  const d2 = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE6uKAh_Y0UG7hUm8N2NmVFQyaowm9HWP7EMNmYBSUrNtrDovVl4J0sYneKUg_xm4wnqtsdxgHVIfSunJn2bStM4sRhEblAXMsesHrd0sdU5UXboGs6zhVvcqval2P67ZGBlkDL_jHfbONzZv9T7_zevV8QVZRmAlzIdkvpa_iESjaoLTyZ-3tiBHh1ttDae7V6MY1KL0lR3JEH6grVq1Ip';

  console.log("Resolving Day 1...");
  const loc1 = await resolveRedirect(d1);
  console.log("Day 1 original:", loc1);

  console.log("Resolving Day 2...");
  const loc2 = await resolveRedirect(d2);
  console.log("Day 2 original:", loc2);
}

run();
