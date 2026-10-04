async function inspectParsing() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
  };

  console.log('--- Fetching Listing HTML ---');
  const resListing = await fetch('https://mostaql.com/projects', { headers });
  const htmlListing = await resListing.text();

  // Inspect detail page
  const projectUrlMatch = htmlListing.match(/href="(https:\/\/mostaql\.com\/project\/\d+-[^"]+)"/);
  if (projectUrlMatch) {
    const detailUrl = projectUrlMatch[1];
    console.log('Fetching detail URL:', detailUrl);
    const resDetail = await fetch(detailUrl, { headers });
    const htmlDetail = await resDetail.text();

    console.log('\n--- Detail Page Elements ---');

    // Title
    const title = htmlDetail.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]+>/g, '').trim();
    console.log('Title:', title);

    // Published date from datetime
    const dateMatch = htmlDetail.match(/datetime="([^"]+)"/);
    console.log('Published At Datetime:', dateMatch ? dateMatch[1] : 'N/A');

    // Budget & Bids & Execution time (often in metadata tables/card)
    // Find table or meta list items
    const metaItems = htmlDetail.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || htmlDetail.match(/<div class="[^"]*project-meta[^"]*"[\s\S]*?<\/div>/g);
    console.log('Meta rows sample count:', metaItems?.length);

    // Extract text from meta table / details
    const cleanText = htmlDetail.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
    
    // Look for budget
    const budgetMatch = cleanText.match(/الميزانية[\s\S]*?<td>([\s\S]*?)<\/td>/);
    console.log('Budget raw:', budgetMatch ? budgetMatch[1].replace(/<[^>]+>/g, '').trim() : 'N/A');

    // Look for execution time
    const execTimeMatch = cleanText.match(/مدة التنفيذ[\s\S]*?<td>([\s\S]*?)<\/td>/);
    console.log('Execution Time raw:', execTimeMatch ? execTimeMatch[1].replace(/<[^>]+>/g, '').trim() : 'N/A');

    // Look for bids count
    const bidsMatch = cleanText.match(/عدد العروض[\s\S]*?<td>([\s\S]*?)<\/td>/);
    console.log('Bids Count raw:', bidsMatch ? bidsMatch[1].replace(/<[^>]+>/g, '').trim() : 'N/A');

    // Look for status
    const statusMatch = cleanText.match(/حالة المشروع[\s\S]*?<td>([\s\S]*?)<\/td>/);
    console.log('Status raw:', statusMatch ? statusMatch[1].replace(/<[^>]+>/g, '').trim() : 'N/A');

    // Client info
    const clientMatch = cleanText.match(/href="(https:\/\/mostaql\.com\/u\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    console.log('Client URL:', clientMatch ? clientMatch[1] : 'N/A');
    console.log('Client Name:', clientMatch ? clientMatch[2].replace(/<[^>]+>/g, '').trim() : 'N/A');

    // Skills
    const skillsMatches = [...htmlDetail.matchAll(/href="https:\/\/mostaql\.com\/skills\/[^"]+"[^>]*>([\s\S]*?)<\/a>/g)];
    const skills = skillsMatches.map(m => m[1].replace(/<[^>]+>/g, '').trim());
    console.log('Skills/Tags:', skills);

    // Description
    const descMatch = htmlDetail.match(/id="project-brief"[\s\S]*?>([\s\S]*?)<\/div>/) || htmlDetail.match(/class="[^"]*project-brief[^"]*"[\s\S]*?>([\s\S]*?)<\/div>/);
    console.log('Description length:', descMatch ? descMatch[1].length : 0);
    console.log('Description snippet:', descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 150) : 'N/A');
  }
}

inspectParsing();
