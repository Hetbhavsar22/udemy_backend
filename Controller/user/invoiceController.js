const nodemailer = require("nodemailer");
const ejs = require("ejs");
const path = require("path");
const puppeteer = require("puppeteer");

const generateInvoicePDF = async (invoice) => {
  try {
    const templatePath = path.join(
      __dirname,
      "../../views/invoiceTemplate.ejs"
    );

    if (!invoice.coursePurchase || !invoice.coursePurchase.invoiceNumber) {
      throw new Error("Invalid invoice data: Missing coursePurchase details.");
    }

    const html = await ejs.renderFile(templatePath, invoice);

    const pdfPath = path.join(
      __dirname,
      `../../public/invoice/invoice_${invoice.coursePurchase.invoiceNumber}.pdf`
    );

    const browser = await puppeteer.launch({
      headless: "new", 
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "load" });

    await page.pdf({ path: pdfPath, format: "A4", printBackground: true });

    await browser.close();

    return pdfPath;
  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    throw new Error("Error generating invoice PDF.");
  }
};

module.exports = {
  generateInvoicePDF,
};
