#!/usr/bin/env node

/**
 * Helper script to find your local IP address for mobile development
 * Run: node get-local-ip.js
 */

const os = require('os');

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    const ips = [];

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal (loopback) and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push({
                    interface: name,
                    address: iface.address,
                });
            }
        }
    }

    return ips;
}

console.log('\n🔍 Finding your local IP addresses...\n');

const ips = getLocalIP();

if (ips.length === 0) {
    console.log('❌ No network interfaces found!');
    console.log('   Make sure you are connected to a network.\n');
    process.exit(1);
}

console.log('📡 Available IP addresses:\n');

ips.forEach((ip, index) => {
    console.log(`   ${index + 1}. ${ip.address}  (${ip.interface})`);
});

console.log('\n✅ Use one of these IPs in your config.ts:');
console.log(`\n   export const API_BASE_URL = 'http://${ips[0].address}:3000';\n`);

console.log('💡 Tips:');
console.log('   - Use the IP that matches your WiFi network');
console.log('   - Ensure your phone is on the same WiFi');
console.log('   - Port 3000 is the default for Next.js dev server\n');
