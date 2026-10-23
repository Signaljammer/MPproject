const fs = require('fs');
const path = require('path');
const msgpack = require('@msgpack/msgpack');

async function run() {
    const dir = path.join(__dirname, "decoded_configs");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    console.log("Fetching latest configuration index manifest...");
    
    try {
        // Fetch the config list manifest directly from the game client API
        const manifestRes = await fetch("https://mighty-party.com/cc_api/configs_list", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Referer": "https://mighty-party.com/",
                "Origin": "https://mighty-party.com"
            }
        });

        if (!manifestRes.ok) {
            throw new Error(`Failed to fetch config manifest: HTTP ${manifestRes.status}`);
        }

        const manifestBuf = await manifestRes.arrayBuffer();
        const manifestData = msgpack.decode(new Uint8Array(manifestBuf));
        
        // Extract endpoints dynamically from the server response structure
        const configData = manifestData.result?.config_data || manifestData;
        
        console.log(`Discovered ${Object.keys(configData).length} configuration endpoints. Downloading...`);

        for (const [name, info] of Object.entries(configData)) {
            try {
                const urlPath = typeof info === 'string' ? info : info.url;
                if (!urlPath) continue;

                const targetUrl = `https://mighty-party.com${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
                const res = await fetch(targetUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                        "Referer": "https://mighty-party.com/",
                        "Origin": "https://mighty-party.com"
                    }
                });

                if (!res.ok) {
                    console.warn(`Skipped ${name}: HTTP ${res.status}`);
                    continue;
                }

                const buf = await res.arrayBuffer();
                const json = msgpack.decode(new Uint8Array(buf));
                fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(json, null, 2));
                console.log(`Saved: ${name}.json`);
            } catch (e) {
                console.error(`Error on ${name}:`, e.message);
            }
        }
        console.log("All configurations processed successfully!");
    } catch (err) {
        console.error("Critical error fetching manifest:", err.message);
        process.exit(1);
    }
}

run();
