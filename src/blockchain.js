/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message`
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *
 */

const SHA256 = require("crypto-js/sha256");
const BlockClass = require("./block.js");
const bitcoinMessage = require("bitcoinjs-message");

class Blockchain {
  /**
   * Constructor of the class, you will need to setup your chain array and the height
   * of your chain (the length of your chain array).
   * Also everytime you create a Blockchain class you will need to initialized the chain creating
   * the Genesis Block.
   * The methods in this class will always return a Promise to allow client applications or
   * other backends to call asynchronous functions.
   */
  constructor() {
    this.chain = [];
    this.height = -1;
    this.initializeChain();
  }

  /**
   * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
   * You should use the `addBlock(block)` to create the Genesis Block
   * Passing as a data `{data: 'Genesis Block'}`
   */
  async initializeChain() {
    if (this.height === -1) {
      let block = new BlockClass.Block({ data: "Genesis Block" });
      await this._addBlock(block);
    }
  }

  /**
   * Utility method that return a Promise that will resolve with the height of the chain
   */
  getChainHeight() {
    return new Promise((resolve, reject) => {
      resolve(this.height);
    });
  }

  /**
   * _addBlock(block) will store a block in the chain
   * @param {*} block
   * The method will return a Promise that will resolve with the block added
   * or reject if an error happen during the execution.
   * You will need to check for the height to assign the `previousBlockHash`,
   * assign the `timestamp` and the correct `height`...At the end you need to
   * create the `block hash` and push the block into the chain array. Don't for get
   * to update the `this.height`
   * Note: the symbol `_` in the method name indicates in the javascript convention
   * that this method is a private method.
   */
  async _addBlock(block) {
    try {
      if (this.chain.length > 0) {
        block.time = new Date().getTime().toString().slice(0, -3);
        block.height = this.chain.length;
        block.previousBlockHash = this.chain[this.chain.length - 1].hash;
        block.hash = await SHA256(JSON.stringify(block)).toString();
        //validate chain
        this.validateChain(block);
        return;
      } else {
        block.time = new Date().getTime().toString().slice(0, -3);
        block.height = this.chain.length;
        block.hash = await SHA256(JSON.stringify(block)).toString();
        this.chain.push(block);
      }
    } catch (error) {
      console.error(error);
    } finally {
      return block;
    }
  }

  /**
   * The requestMessageOwnershipVerification(address) method
   * will allow you  to request a message that you will use to
   * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
   * This is the first step before submit your Block.
   * The method return a Promise that will resolve with the message to be signed
   * @param {*} address
   */
  async requestMessageOwnershipVerification(address) {
    let message;
    try {
      message = await `${address}:${new Date()
        .getTime()
        .toString()
        .slice(0, -3)}:starRegistry`;
    } catch (error) {
      console.log(error);
    } finally {
      return message;
    }
  }

  /**
   * The submitStar(address, message, signature, star) method
   * will allow users to register a new Block with the star object
   * into the chain. This method will resolve with the Block added or
   * reject with an error.
   * Algorithm steps:
   * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
   * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
   * 3. Check if the time elapsed is less than 5 minutes
   * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
   * 5. Create the block and add it to the chain
   * 6. Resolve with the block added.
   * @param {*} address
   * @param {*} message
   * @param {*} signature
   * @param {*} star
   */
  async submitStar(address, message, signature, star) {
    let errorLogs = [];
    let block;
    try {
      let messageTime, currentTime, timeElapsed;
      messageTime = message.split(":")[1];
      currentTime = parseInt(new Date().getTime().toString().slice(0, -3));
      timeElapsed = currentTime - messageTime;
      let verify = await bitcoinMessage.verify(message, address, signature);
      if (timeElapsed >= 5 * 60) {
        errorLogs.push(
          "submission timed out, message was signed more than 5min ago"
        );
        return;
      } else if (!verify) {
        errorLogs.push("signature don't match, please resign message");
        return;
      } else {
        block = new BlockClass.Block({ owner: address, star });
      }
    } catch (error) {
      console.log(error);
    } finally {
      if (!block) {
        console.log(errorLogs);
        return;
      }
      return this._addBlock(block);
    }
  }

  /**
   * This method will return a Promise that will resolve with the Block
   *  with the hash passed as a parameter.
   * Search on the chain array for the block that has the hash.
   * @param {*} hash
   */
  async getBlockByHash(hash) {
    let block;
    for (var i = 0; i < this.chain.length; i++) {
      if (this.chain[i].hash === hash) {
        block = await this.chain[i];
        return block;
      }
    }
  }

  /**
   * This method will return a Promise that will resolve with the Block object
   * with the height equal to the parameter `height`
   * @param {*} height
   */
  async getBlockByHeight(height) {
    let block;
    try {
      block = await this.chain.filter((p) => p.height === height)[0];
    } catch (error) {
      console.log(error);
    } finally {
      return block;
    }
  }

  /**
   * This method will return a Promise that will resolve with an array of Stars objects existing in the chain
   * and are belongs to the owner with the wallet address passed as parameter.
   * Remember the star should be returned decoded.
   * @param {*} address
   */
  async getStarsByWalletAddress(address) {
    let stars = [];
    try {
      await this.chain.map((block, index) => {
        let data = block.getBData();
        if (index > 0) {
          data.owner === address ? stars.push(data) : "";
        }
      });
    } catch (error) {
      console.log(error);
    } finally {
      return stars;
    }
  }

  /**
   * This method will return a Promise that will resolve with the list of errors when validating the chain.
   * Steps to validate:
   * 1. You should validate each block using `validateBlock`
   * 2. Each Block should check the with the previousBlockHash
   */
  async validateChain(block) {
    let errorLogs = [];
    let isValidBlock;
    try {
      let chain = this.chain;
      let lastBlock = chain.length - 1;
      await chain.map(async (block, index) => {
        if (index === lastBlock) {
          return;
        }
        let blockHash = chain[index].hash;
        let previousBlockHash = chain[index + 1].previousBlockHash;
        // validate blocks with validate method
        isValidBlock = await block.validate();
        errorLogs.push(isValidBlock);
        if (!isValidBlock) {
          console.log(`Block height ${block.height} is not valid`);
          return;
        } else if (previousBlockHash !== blockHash) {
          console.log(`Block height ${block.height} previous hash don't match`);
          isValidBlock = fslse;
          return;
        }
      });
    } catch (error) {
      console.log(error);
    } finally {
      if (!block) {
        let valid = await errorLogs;
        if (valid.includes(false) === true) {
          return false;
        } else {
          return true;
        }
      } else {
        this.chain.push(block);
      }
    }
  }
}

module.exports.Blockchain = Blockchain;
