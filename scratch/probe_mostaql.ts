async function probeMostaql() {
  console.log('=== Probing Mostaql Web Source ===');
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  };

  try {
    // 1. Fetch Page 1
    console.log('Fetching https://mostaql.com/projects ...');
    const res1 = await fetch('https://mostaql.com/projects', { headers });
    console.log('Page 1 Status:', res1.status, res1.statusText);
    console.log('Final URL:', res1.url);
    const html1 = await res1.text();
    console.log('Page 1 HTML Length:', html1.length);

    // Extract project links using regex
    const projectUrlRegex = /href="(https:\/\/mostaql\.com\/project\/\d+-[^"]+)"/g;
    const projectUrls: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = projectUrlRegex.exec(html1)) !== null) {
      if (!projectUrls.includes(match[1])) {
        projectUrls.push(match[1]);
      }
    }
    console.log(`Found ${projectUrls.length} distinct project URLs on Page 1.`);
    console.log('Sample URLs:', projectUrls.slice(0, 3));

    // 2. Fetch Detail Page of the first project
    if (projectUrls.length > 0) {
      const detailUrl = projectUrls[0];
      console.log(`\nFetching detail page: ${detailUrl}`);
      const resDetail = await fetch(detailUrl, { headers });
      console.log('Detail Status:', resDetail.status);
      const detailHtml = await resDetail.text();
      console.log('Detail HTML Length:', detailHtml.length);
      const titleMatch = detailHtml.match(/<title[^>]*>(.*?)<\/title>/s);
      console.log('Detail Title:', titleMatch ? titleMatch[1].trim() : 'N/A');

      // Check for time tag or relative published date
      const timeMatches = detailHtml.match(/<time[^>]*datetime="([^"]+)"[^>]*>(.*?)<\/time>/gs);
      console.log('Detail <time> tags found:', timeMatches);
    }

    // 3. Fetch Page 2
    console.log('\nFetching Page 2: https://mostaql.com/projects?page=2');
    const res2 = await fetch('https://mostaql.com/projects?page=2', { headers });
    console.log('Page 2 Status:', res2.status);
    const html2 = await res2.text();
    const p2Urls: string[] = [];
    while ((match = projectUrlRegex.exec(html2)) !== null) {
      if (!p2Urls.includes(match[1])) {
        p2Urls.push(match[1]);
      }
    }
    console.log(`Found ${p2Urls.length} distinct project URLs on Page 2.`);
    console.log('Sample Page 2 URLs:', p2Urls.slice(0, 3));

  } catch (err) {
    console.error('Probe failed:', err);
  }
}

probeMostaql();
