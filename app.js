const axios = require("axios");
const cheerio = require("cheerio");

store = {};

const getFilteredLinkList = async () => {
  let res = await axios.get(
    `https://www.livingspaces.com/inspiration/ideas-advice`
  );
  const $ = cheerio.load(res.data);

  let rawLinks = [];

  $("a").each(function(i, elem) {
    rawLinks.push($(this).attr("href"));
  });

  let filteredLinks = rawLinks
    .filter(link => {
      if (link && link.match(/\//g)) {
        if (link.match(/\//g).length >= 4) {
          return link.search("ideas-advice") > -1;
        }
      }
    })
    .filter((item, pos, self) => {
      return self.indexOf(item) == pos;
    });

  return filteredLinks;
};

const getSkus = async linkArray => {
  promises = linkArray.map(link => {
    return axios.get(`https://www.livingspaces.com${link}`);
  });

  let fulfilledPromises = await Promise.all(promises);

  fulfilledPromises.map(res => {
    let currentUrl = res.request.path;
    const $ = cheerio.load(res.data);
    let skuList = [];
    // Gets the SKUs on the page
    $(".bloomreach-block .product-item").each(function() {
      skuList.push($(this).data("sku"));
    });
    store[currentUrl] = {
      title: $("h1.title").text(),
      skus: skuList
    };
  });
  return;
};

const checkSkuStatus = async () => {
  for (let key in store) {
    store[key]["suspiciousSkus"] = [];
    let promises = store[key]["skus"].map(sku => {
      sku = String(sku);
      sku = sku.search("cv") > -1 ? sku.split("cv")[0] : sku;
      return axios
        .get(`https://www.livingspaces.com/api/restfulproducts?pid=${sku}`)
        .catch(() => false);
    });

    // wait for API calls to resolve assign to array
    let completePromises = await Promise.all(promises);

    completePromises.map(promise => {
      if (promise && promise.data.products[0].productStatus != "Active") {
        store[key]["suspiciousSkus"].push(promise.data.products[0].pid);
      }
    });
  }
};

const formatForEmail = () => {
  emailBody = "There might be issues with the following SKUs:\n\n\n";
  Object.keys(store).map(key => {
    if (store[key].suspiciousSkus.length) {
      emailBody += `https://livingspaces.com${key}     ${store[
        key
      ].suspiciousSkus.join(", ")}\n`;
    }
  });
  return emailBody;
};

// Execution block
(async () => {
  let filteredLinks = await getFilteredLinkList();
  await getSkus(filteredLinks);
  await checkSkuStatus();
  let emailBody = formatForEmail();
  return emailBody;
})();
