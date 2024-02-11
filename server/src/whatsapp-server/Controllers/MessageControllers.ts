// controllers/messageController.js
import WAWebJS, { Client, Order } from 'whatsapp-web.js';
import {
  initializeGoogleSheets,
  loadSheetByTitle,
} from '../../middlewares/googleSheets';
import { formatDateToDDMonthYYYY } from '../../utils/date';
import {
  createNewInvoice,
  getRowsByPropertyName,
  getRowsObject,
  getValue,
} from '../../utils/googleSheets';
import CommandHandler from '../handlers/CommandHandler';
import { RawOrder } from '../../types/Order.model';

class MessageController {
  client: Client;
  commandHandler: CommandHandler;
  message!: WAWebJS.Message;
  constructor(client: Client) {
    this.client = client;
    this.commandHandler = new CommandHandler(this);
  }

  handleIncomingMessage(message: WAWebJS.Message) {
    if (message.body.startsWith('/')) {
      this.message = message;
      this.commandHandler.handleCommand(message.body);
    } else {
      console.log('Received message:', message.body);
    }
  }

  async handleSendOrderCommand(args: string[]) {
    // Implement logic to handle the "/send-order" command and process order data
    const newOrder = this.parseOrderData(args);
    newOrder['Order Date'] = formatDateToDDMonthYYYY(new Date());
    try {
      const doc = await initializeGoogleSheets();
      const sheet = await loadSheetByTitle(doc, 'Order', 2);
      const orders = getRowsObject<RawOrder>(await sheet.getRows<Order>());
      const existingInvoiceNumbers = orders.map((order) =>
        getValue(order['Invoice']),
      );
      if (newOrder.Invoice === undefined || newOrder.Invoice === '') {
        const newInvoice = createNewInvoice(existingInvoiceNumbers);
        newOrder.Invoice = newInvoice;
      }

      const containsOnlyNonNumeric = /^[^0-9]+$/.test(newOrder.Invoice);
      if (containsOnlyNonNumeric) {
        const newInvoice = createNewInvoice(
          existingInvoiceNumbers,
          newOrder.Invoice,
        );
        newOrder.Invoice = newInvoice;
      }

      const existingOrder = orders.find(
        (row) => row['Invoice'] === newOrder.Invoice,
      );
      if (existingOrder !== undefined) {
        throw {
          name: 'Bad Request',
          message: 'The invoice already exists!',
        };
      }

      await sheet.addRow(newOrder);
      const parsedObject = JSON.parse(JSON.stringify(newOrder));
      let replyMessage = `Send an order ${newOrder.Invoice} with data:\n`;
      for (const [key, value] of Object.entries(parsedObject)) {
        if (value != '' || value != undefined) {
          replyMessage += `${key}: ${value}\n`;
        }
      }
      await this.client.sendMessage(this.message.from, replyMessage);
    } catch (error: any) {
      await this.client.sendMessage(this.message.from, error.message);
    }
  }

  handleGetTemplateCommand(args: string[]) {
    // Implement logic to handle the "/get-template" command
    const command = args[0];
    this.commandHandler.handleCommand(command, true);
  }

  async handleUpdateCommand(args: string[], params: string[]) {
    // Implement logic to handle the "/update/:id" command with the provided ID
    const invoice = params[0];
    const updateOrder = this.parseOrderData(args);
    try {
      const doc = await initializeGoogleSheets();
      const sheet = await loadSheetByTitle(doc, 'Order', 2);
      const rawRows = await sheet.getRows<RawOrder>();
      const requestedOrder = getRowsByPropertyName(
        rawRows,
        'Invoice',
        invoice,
      )[0];
      if (requestedOrder === undefined) {
        throw {
          name: 'Not Found',
          message: `Order with invoice number ${invoice} is not found`,
        };
      }

      if (invoice !== updateOrder.Invoice) {
        const existingOrder = getRowsObject<RawOrder>(rawRows).find(
          (row) => row.Invoice === updateOrder.Invoice,
        );
        if (existingOrder !== undefined) {
          throw {
            name: 'Bad Request',
            message: 'The invoice already exists!',
          };
        }
      }

      Object.keys(updateOrder).forEach((key) => {
        requestedOrder.set(key, updateOrder[key]);
      });
      await requestedOrder.save();

      const parsedObject = JSON.parse(JSON.stringify(requestedOrder));
      let replyMessage = `Updating order ${invoice} with data:\n`;
      for (const [key, value] of Object.entries(parsedObject)) {
        if (value != '' || value != undefined) {
          replyMessage += `${key}: ${value}\n`;
        }
      }
      await this.client.sendMessage(this.message.from, replyMessage);
    } catch (error: any) {
      await this.client.sendMessage(this.message.from, error.message);
    }
  }

  async handleGetOrderCommand(args: string[]) {
    // Implement logic to handle the "/get-order/:id" command with the provided ID
    const invoice = args[0];
    try {
      const doc = await initializeGoogleSheets();
      const sheet = await loadSheetByTitle(doc, 'Order', 2);
      const requestedOrder = getRowsObject<RawOrder>(
        await sheet.getRows<RawOrder>(),
      )?.find((row): boolean => row.Invoice === invoice);
      if (requestedOrder === undefined) {
        throw {
          name: 'Not Found',
          message: `Order with invoice ${invoice} is not found`,
        };
      }

      const parsedObject = JSON.parse(JSON.stringify(requestedOrder));
      let replyMessage = 'Here are the details:\n';
      for (const [key, value] of Object.entries(parsedObject)) {
        if (value != '' || value != undefined) {
          replyMessage += `${key}: ${value}\n`;
        }
      }
      await this.client.sendMessage(this.message.from, replyMessage);
    } catch (error: any) {
      await this.client.sendMessage(this.message.from, error.message);
    }
  }

  async handleGetCommandsCommand() {
    // Implement logic to handle the "/get-commands" command
    try {
      const replyMessage =
        'Available commands:\n/send-order\n/get-template <Command>\n/update-order <Invoice Number>\n/get-order <Invoice Number>\n/get-commands';
      await this.client.sendMessage(this.message.from, replyMessage);
    } catch (error: any) {
      await this.client.sendMessage(this.message.from, error.message);
    }
  }

  async sendTemplate(replyMessage: string) {
    try {
      await this.client.sendMessage(this.message.from, replyMessage);
    } catch (error: any) {
      await this.client.sendMessage(this.message.from, error.message);
    }
  }

  private parseOrderData(args: string[]): RawOrder {
    // Implement logic to parse order data from the message body
    // Example: "/send-order invoice: N1023001 orderDate: 05 October 2023 ..."
    // Extract data and return an object
    const orderData: RawOrder = {
      Nr: '',
      Discount: '',
      Shipping: '',
      TotalPrice: '',
      Packaging: '',
      Invoice: '',
      Name: '',
      'Phone Number': '',
      Address: '',
      'Order Date': '',
      'Shipment Date': '',
      'Payment Method': '',
      Information: '',
      FeedBack: '',
    };
    args.forEach((arg) => {
      const [key, value] = arg.split(':');
      if (key && value) {
        orderData[key.trim()] = value.trim();
      }
    });
    return orderData;
  }
}

export default MessageController;