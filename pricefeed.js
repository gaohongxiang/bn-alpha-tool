async function getPrice(symbol) {
    // 1. 查询可用符号
    const symbolsResponse = await fetch('https://oracle.binance.com/api/v1/symbols');
    // const symbols = await symbolsResponse.json();
    console.log(symbolsResponse);
    // const priceResponse = await fetch(`https://oracle.binance.com/api/v1/price?symbol=${symbol}/USDT`);
    // console.log(priceResponse);
    // const priceData = await priceResponse.json();
    // console.log(`${symbol}价格:`, priceData.price);
}

getPrice('ZKJ');
// getPrice('ROAM');
// getPrice('DEGEN');
// getPrice('BTC');
// getPrice('ETH');
// getPrice('BNB');
