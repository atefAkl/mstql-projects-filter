async function dumpMetaPanel() {
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

    const metaPanel = htmlDetail.match(/id="project-meta-panel"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
    console.log('=== Meta Panel HTML ===');
    console.log(metaPanel ? metaPanel[0] : 'Meta panel not found');

    // Also check skills tags section
    const skillsSection = htmlDetail.match(/href="https:\/\/mostaql\.com\/skills\/[^"]+"[\s\S]*?<\/a>/g);
    console.log('=== Skills tags ===');
    console.log(skillsSection);
  }
}

dumpMetaPanel();
