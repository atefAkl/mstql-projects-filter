async function dumpDetailHtml() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
  };

  const resListing = await fetch('https://mostaql.com/projects', { headers });
  const htmlListing = await resListing.text();
  const projectUrlMatch = htmlListing.match(/href="(https:\/\/mostaql\.com\/project\/\d+-[^"]+)"/);
  
  if (projectUrlMatch) {
    const detailUrl = projectUrlMatch[1];
    console.log('Fetching:', detailUrl);
    const resDetail = await fetch(detailUrl, { headers });
    const htmlDetail = await resDetail.text();

    // Dump key sections of HTML
    const tableMatch = htmlDetail.match(/<table[^>]*class="[^"]*table-meta[^"]*"[\s\S]*?<\/table>/) || htmlDetail.match(/<table[\s\S]*?<\/table>/g);
    console.log('=== Tables found in HTML ===');
    if (tableMatch) {
      if (Array.isArray(tableMatch)) {
        tableMatch.forEach((tbl, idx) => {
          console.log(`--- Table ${idx + 1} ---`);
          console.log(tbl);
        });
      } else {
        console.log(tableMatch);
      }
    }

    // Dump meta sidebar or info card
    const cardMatch = htmlDetail.match(/<div[^>]*class="[^"]*card[^"]*"[\s\S]*?<\/div>/g);
    console.log('=== Card Divs count ===:', cardMatch?.length);
    cardMatch?.slice(0, 3).forEach((card, idx) => {
      console.log(`--- Card ${idx + 1} ---`);
      console.log(card.slice(0, 500));
    });
  }
}

dumpDetailHtml();
