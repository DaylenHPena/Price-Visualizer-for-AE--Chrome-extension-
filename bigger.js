class DataManager {
  constructor(jsonData) {
    this.data = jsonData;
  }

  setProps() {
    this.priceList = this.getPriceList();
    this.propsList = this.getPropsList(this.data);
    this.colorList = this.getColorPropData(this.data);
  }

  getPriceList() {
    return this.data["skuModule"]["skuPriceList"];
  }

  getPropsList() {
    return this.data["skuModule"]["productSKUPropertyList"];
  }

  getColorMainIDNaive() {
    if (Object.hasOwnProperty(this, "colorPropID")) {
      return this.colorPropID;
    } else {
      for (let index = 0; index < this.propsList.length; index++) {
        const element = this.propsList[index]["skuPropertyValues"];
        const found = element.find(
          (prop) => prop["skuPropertyImagePath"] != undefined
        );
        if (found) {
          this.colorPropID = this.propsList[index]["skuPropertyId"];
          return this.colorPropID;
        }
      }
      this.colorPropID = 14;
      return this.colorPropID;
    }

    //TODO: Check if the prop have imagePath, then is the main color prop
  }

  getColorPropData() {
    return this.propsList.find(
      (item) => item["skuPropertyId"] == this.getColorMainIDNaive()
    );
  }

  pricesForProp(propName) {
    var prices = this.priceList.filter((item) =>
      item["skuAttr"].includes(propName)
    );
    return this.getShipsFromProp() //filter the results by the hidden prop "Ships From" if existe
      ? prices.filter((item) => item["skuAttr"].includes(this.getChinaPropId()))
      : prices;
  }

  getColorImage(colorId) {
    return this.colorList["skuPropertyValues"].find((item) => {
      console.log("item", item, "colorId", colorId);
      return item["propertyValueId"] == colorId;
    })?.skuPropertyImagePath;
  }

  getPropId(propName) {
    for (let index = 0; index < this.propsList.length; index++) {
      const element = this.propsList[index]["skuPropertyValues"];
      const found = element.find(
        (prop) => prop["propertyValueDisplayName"] == propName
      );
      if (found) {
        return found.propertyValueId;
      }
    }
  }

  getShippingFee() {
    const matches =
      this.data["shippingModule"]["generalFreightInfo"][
        "shippingFeeText"
      ].match(/(?:[$])(.*)/);
    return matches ? parseFloat(matches[1]) : 0;
  }

  getShipsFromProp() {
    return this.getPropsList().find(
      (prop) => prop["skuPropertyId"] == 200007763
    );
  }

  getChinaPropId() {
    return 201336100;
  }

  getNumberPerLot() {
    return this.data["priceModule"]["numberPerLot"] || 1;
  }

  getUnitName() {
    return this.data["priceModule"]["oddUnitName"];
  }
}

class DomManager {
  constructor(document) {
    this.document = document;
  }

  getIconsWrappers() {
    return this.document.getElementsByClassName("sku-property-image");
  }

  getIcons() {
    if (Object.hasOwnProperty("icons")) {
      return this.icons;
    } else {
      this.icons = Array.from(this.getIconsWrappers()).map(
        (div) => div.firstChild
      );
      return this.icons;
    }
  }

  getIconWith(url) {
    console.log("this.getIcons()", this.getIcons());
    this.getIcons().find((item) => {
      console.log("item", item);
      return item.src == url;
    });
    return this.getIcons().find((item) => item.src == url);
  }

  getVariants() {
    return this.document.getElementsByClassName("sku-property-text");
  }
}

class DomModifier {
  constructor(domManager = new DomManager(null)) {
    this.domManager = domManager;
  }

  addPriceTag() {
    Array.from(domManager.getIconsWrappers()).forEach((item) => {
      const price = document.createElement("p");
      price.innerHTML = "?";
      price.className = "price_detail";
      item.appendChild(price);
    });
  }

  addPricePerUnitTag() {
    Array.from(domManager.getIconsWrappers()).forEach((item) => {
      const price = document.createElement("p");
      price.className = "priceperunit";
      item.appendChild(price);
    });
  }

  enlargeIcons() {
    Array.from(domManager.getIcons()).forEach((item) => {
      item.src = this.clearUrl(item.src);
    });
  }

  clearUrl(url) {
    const match = url.match(/_50x50[.]\D\D\D_.webp/);
    if (match) {
      const ext = match[0].match(/[.]\D\D\D/) || "";
      return url.replace(match, `_640x640${ext}`);
    }
    return url;
  }
}

function getProductInfoRawScript() {
  //gets the script that contains the data inside window.runParams
  const scripts = document.getElementsByTagName("script");
  return Array.from(scripts).find(
    (script) => script.innerHTML.search("window.runParams") != -1
  );
}

function scriptToJson(script) {
  return JSON.parse(script.innerHTML.match(/{.*}/));
}

function updatePriceTag(
  dataManager = new DataManager(null),
  priceList,
  domManager = new DomManager(null)
) {
  const shippingFee = dataManager.getShippingFee();
  const hiddenShippingProp = dataManager.getShipsFromProp() != undefined;

  priceList.forEach((item) => {
    const colorPair = item["skuAttr"]
      .split(";")
      .find(
        (pairs) => pairs.split(":")[0] == dataManager.getColorMainIDNaive()
      ); //naive
    const color = colorPair.split(":")[1].split("#")[0];
    const imageUrl = dataManager.getColorImage(
      color,
      dataManager.getColorPropData()
    );
    try {
      const next = domManager.getIconWith(imageUrl).nextSibling;
      if (next) {
        const rawPrice = item["skuVal"]["skuActivityAmount"]["value"];
        const price =
          shippingFee > 0 && !hiddenShippingProp
            ? (rawPrice + shippingFee).toFixed(2)
            : rawPrice; //some pages have a hidden Ship From prop that affect the shipping price
        next.innerHTML =
          rawPrice != price ? `$${price} (w/shipping)` : `$${price}`;

        if (dataManager.getNumberPerLot() > 1) {
          next.nextSibling.innerHTML = `$${(
            price / dataManager.getNumberPerLot()
          ).toFixed(2)} per ${dataManager.getUnitName()}`;
        }
      }
    } catch (error) {
      console.log("error :>> ", error);
    }
  });
}

function addClickHandlerForVariants(dataManager, domManager) {
  //change the displayed price if another variant is selected
  document
    .querySelectorAll(".sku-property-item .sku-property-text")
    .forEach((item) => {
      item.addEventListener("click", (event) => {
        const propName =
          event.target.tagName == "SPAN"
            ? event.target.innerHTML
            : event.target.firstChild.innerHTML;
        //update prices
        const prices = dataManager.pricesForProp(
          dataManager.getPropId(propName)
        );
        updatePriceTag(dataManager, prices, domManager);
      });
    });
}

// Execution
const domManager = new DomManager(document);

const dataManager = new DataManager(scriptToJson(getProductInfoRawScript()));
dataManager.setProps();
const domModifier = new DomModifier(domManager);
domModifier.addPriceTag();
domModifier.addPricePerUnitTag();
domModifier.enlargeIcons();

var prices = domManager.getVariants().length
  ? dataManager.pricesForProp(
      dataManager.getPropId(domManager.getVariants()[0].firstChild.innerHTML)
    )
  : dataManager.getPriceList();
updatePriceTag(dataManager, prices, domManager);
addClickHandlerForVariants(dataManager, domManager);
console.log("prices :>> ", prices);
console.log("dataManager.propsList :>> ", dataManager.propsList);
console.log("dataManager.colorList :>> ", dataManager.colorList);
/*console.log("dataManager.data :>> ", dataManager.data);


//TODO check selected variant for first lookup of price. More than 1 variant lookup

const scripts = document.getElementsByTagName("script");
console.log("SCRIPTSSSSSS");
Array.from(scripts).forEach((script) => {
  console.log(script.innerHTML);
});*/
