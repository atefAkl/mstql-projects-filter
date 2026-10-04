async function findBidsCount() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
  };

  const resListing = await fetch('https://mostaql.com/projects', { headers });
  const htmlListing = await resListing.text();
  const projectUrlMatch = htmlListing.match(/href="(https:\/\/mostaql\.com\/project\/\d+-[^"]+)"/);
  
  if (projectUrlMatch) {
    const detailUrl = projectUrlMatch[1];
    const resDetail = await fetch(detailUrl, { headers });
    const htmlDetail = await resDetail.text();

    // Look for text matching "عرض" or "عروض" or "bids" or numbers near proposal section
    const bidsMatches = htmlDetail.match(/[\d\u0660-\u0669]+\s*(?:عروض|عرض)/g);
    console.log('Bids matches in detail page:', bidsMatches);

    // Also search listing page cards for bids count
    const listingBidsMatches = htmlListing.match(/[\d\u0660-\u0669]+\s*(?:عروض|عرض)/g);
    console.log('Bids matches in listing page:', listingBidsMatches?.slice(0, 10));

    // Find proposal section header in detail page
    const proposalHeader = htmlDetail.match(/<h\d[^>]*>[\s\S]*?(?:العروض المقدمة|عروض)[\s\S]*?<\/h\d>/i) || htmlDetail.match(/class="[^"]*bids[^"]*"[\s\S]*?<\/div>/i);
    console.log('Proposal header sample:', proposalHeader ? proposalHeader[0] : 'N/A');
  }
}

findBidsCount();
