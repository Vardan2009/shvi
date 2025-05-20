export { SymbolTable };

class SymbolTable {
  constructor(localSymbolTable, parent) {
    this.localSymbolTable = localSymbolTable;
    this.parent = parent;
  }

  hasSymbol(symbol) {
    if (typeof symbol !== "symbol") {
      console.error(`Shvi: ${symbol} is not a symbol`);
      return undefined;
    }

    if (symbol in this.localSymbolTable) return true;
    else if (this.parent) return this.parent.hasSymbol(symbol);
    else return false;
  }

  getSymbol(symbol) {
    if (typeof symbol !== "symbol") {
      console.error(`Shvi: ${symbol} is not a symbol`);
      return undefined;
    }

    if (symbol in this.localSymbolTable) return this.localSymbolTable[symbol];
    else if (this.parent) return this.parent.getSymbol(symbol);
    else {
      console.error(
        `Shvi: ${Symbol.keyFor(symbol)} is not defined in this scope`,
      );
      return undefined;
    }
  }

  declareSymbol(symbol, value) {
    if (typeof symbol !== "symbol") {
      console.error(`Shvi: ${symbol} is not a symbol`);
      return undefined;
    }

    if (symbol in this.localSymbolTable) {
      console.error(
        `Shvi: ${Symbol.keyFor(symbol)} is already present in this scope`,
      );
      return undefined;
    }

    this.localSymbolTable[symbol] = value;
  }

  setSymbol(symbol, value) {
    if (typeof symbol !== "symbol") {
      console.error(`Shvi: ${symbol} is not a symbol`);
      return undefined;
    }

    if (symbol in this.localSymbolTable) this.localSymbolTable[symbol] = value;
    else if (this.parent) this.parent.setSymbol(symbol, value);
    else {
      console.error(
        `Shvi: ${Symbol.keyFor(symbol)} is not defined in this scope`,
      );
    }
  }
}
