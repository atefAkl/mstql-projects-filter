async function inspectBidsInListing() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
  };

  const resListing = await fetch('https://mostaql.com/projects', { headers });
  const htmlListing = await resListing.text();

  // Find tr or card rows in listing page
  const rows = htmlListing.match(/<tr[^>]*class="[^"]*project-row[^"]*"[\s\S]*?<\/tr>/g) || htmlListing.match(/<tr[\s\S]*?<\/tr>/g);
  console.log('Project rows in listing:', rows?.length);

  if (rows && rows.length > 0) {
    console.log('=== Sample Row 1 HTML ===');
    console.log(rows[0]);
  }
}

inspectBidsInListing();
