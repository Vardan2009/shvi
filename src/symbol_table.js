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

  setSymbol(symbol, value) {
    if (this.parent && this.parent.hasSymbol(symbol)) {
      this.parent.setSymbol(symbol, value);
    } else this.localSymbolTable[symbol] = value;
  }
}
