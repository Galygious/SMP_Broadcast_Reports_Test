// ==UserScript==
// @name         Heymarket Data Scraper
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Scrapes Heymarket list and conversation data and sends it to Google Sheets.
// @match        https://app.heymarket.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @connect      api-prod-client.heymarket.com
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @connect      *.google.com
// @connect      *.googleusercontent.com
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const SECURITY_TOKEN = "m3mdHdowtqQtLP6ujj-qtPhY4a5usgixARwQEf7IYbI=";
    const TEAM_ID = 64149;
    const MAX_CONVERSATION_MESSAGES = 20;

    // Google Apps Script configuration
    const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw2w0x5sxPHdkHEE-JYrb-qeTWFn9QJAN4WhUKetTqvBSXjyFhgtVdPyUxRniZsP9j4/exec";
    const GOOGLE_SCRIPT_SECRET = "SWEETME2025Shawn";

    async function checkIfTodayAlreadyExported() {
        const today = new Date().toISOString().slice(0,10);

        try {
            console.log("Checking if today's data has already been exported...");

            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: GOOGLE_APPS_SCRIPT_URL,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({
                        secret: GOOGLE_SCRIPT_SECRET,
                        action: 'getSheetNames'
                    }),
                    onload: (response) => {
                        if (response.status === 200) {
                            try {
                                const result = JSON.parse(response.responseText);
                                resolve(result);
                            } catch (e) {
                                reject(new Error("Failed to parse response from Google Apps Script"));
                            }
                        } else {
                            reject(new Error(`Google Apps Script request failed with status: ${response.status}`));
                        }
                    },
                    onerror: (error) => {
                        reject(new Error(`Network error when checking sheets: ${error.statusText}`));
                    }
                });
            });

            // Check if any sheet name starts with today's date
            const sheetNames = response.sheetNames || [];
            return sheetNames.some(name => name.startsWith(today));
        } catch (error) {
            console.warn("Could not check existing sheets:", error);
            return false; // Continue with export if check fails
        }
    }

    // Mapping of inbox_id to brand name
    const BRAND_MAP = {
        '80071': 'BOOKING',
        '80158': 'SCHEDULE',
        '80157': 'RESERVE',
        '80159': 'SESSIONS'
    };

    let allData = [];
    let listData = [];
    let processedLists = new Set();
    let totalReportsToProcess = 0;
    let reportsProcessed = 0;

    function formatPhoneNumber(number) {
        // Remove leading '1' and format as ' (XXX) XXX-XXXX'
        const cleaned = ('' + number).replace(/\D/g, '');
        const match = cleaned.match(/^(\d{1})(\d{3})(\d{3})(\d{4})$/);
        if (match) {
            return `1 (${match[2]}) ${match[3]}-${match[4]}`;
        }
        return number;
    }

    // A simple CSV utility
    function arrayToCSV(data, headers) {
        let csvContent = "";
        if (headers) {
            csvContent += headers.join(",") + "\n";
        }
        data.forEach(row => {
            let rowString = row.map(cell => {
                if (typeof cell === 'string') {
                    // Escape double quotes and enclose in double quotes
                    return `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
            }).join(",");
            csvContent += rowString + "\n";
        });
        return csvContent;
    }

    async function sendToGoogleSheets() {
        if (allData.length === 0) {
            console.log("No data to send to Google Sheets.");
            return;
        }

        // Prepare headers
        const headers = ["Brand", "Fname", "Lname", "Number", "Initial Send Time", "Failed", "Response", "Response Time (Central)"];
        for (let i = 1; i <= MAX_CONVERSATION_MESSAGES; i++) {
            headers.push(`Message ${i}`);
        }

        // Create 2D array for Google Sheets (headers + data)
        const values = [headers, ...allData];

        // Prepare payload for Google Apps Script
        const payload = {
            secret: GOOGLE_SCRIPT_SECRET,
            values: values
        };

        try {
            console.log("Sending data to Google Sheets...");

            // Use GM_xmlhttpRequest for the POST request
            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: GOOGLE_APPS_SCRIPT_URL,
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8'
                    },
                    data: JSON.stringify({
                        secret: GOOGLE_SCRIPT_SECRET,
                        action: 'appendData',
                        values: values
                    }),
                    onload: (response) => {
                        if (response.status === 200) {
                            try {
                                const result = JSON.parse(response.responseText);
                                resolve(result);
                            } catch (e) {
                                reject(new Error("Failed to parse response from Google Apps Script"));
                            }
                        } else {
                            reject(new Error(`Google Apps Script request failed with status: ${response.status}`));
                        }
                    },
                    onerror: (error) => {
                        reject(new Error(`Network error when sending to Google Sheets: ${error.statusText}`));
                    }
                });
            });

            if (response.ok) {
                console.log(`✅ Data successfully sent to Google Sheets! Sheet name: ${response.sheetName}`);
                console.log(`📊 Sent ${allData.length} rows of data to Google Sheets`);

                // Show success message to user
                alert(`Success! Data sent to Google Sheets.\nSheet: ${response.sheetName}\nRows: ${allData.length}`);
            } else {
                throw new Error("Google Apps Script returned error response");
            }
        } catch (error) {
            console.error("❌ Failed to send data to Google Sheets:", error);
            alert(`Failed to send data to Google Sheets: ${error.message}`);

            // Fallback: still offer CSV download
            console.log("Offering CSV download as fallback...");
            downloadCSVFallback();
        }
    }

    function downloadCSVFallback() {
        if (allData.length === 0) {
            console.log("No data to download.");
            return;
        }

        const headers = ["Brand", "Fname", "Lname", "Number", "Initial Send Time", "Failed", "Response", "Response Time (Central)"];
        for (let i = 1; i <= MAX_CONVERSATION_MESSAGES; i++) {
            headers.push(`Message ${i}`);
        }

        const csv = arrayToCSV(allData, headers);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "heymarket_data_fallback.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log("Fallback CSV download initiated.");
    }

    async function fetchWithToken(url, options) {
        options.headers = options.headers || {};
        options.headers['x-emb-security-token'] = SECURITY_TOKEN;
        options.headers['content-type'] = 'application/json;charset=UTF-8';
        options.method = options.method || 'POST';

        // Use GM_xmlhttpRequest for cross-origin requests
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method,
                url: url,
                headers: options.headers,
                data: options.body,
                onload: (response) => {
                    if (response.status === 200) {
                        try {
                            const json = JSON.parse(response.responseText);
                            resolve(json);
                        } catch (e) {
                            reject(new Error("Failed to parse JSON response."));
                        }
                    } else {
                        reject(new Error(`Request failed with status: ${response.status}`));
                    }
                },
                onerror: (error) => {
                    reject(new Error(`Network error: ${error.statusText}`));
                }
            });
        });
    }

    async function fetchLists() {
        // Check if today's data has already been exported
        const alreadyExported = await checkIfTodayAlreadyExported();
        if (alreadyExported) {
            const today = new Date().toISOString().slice(0,10);
            const confirmMessage = `Data for ${today} has already been exported to Google Sheets today.\n\nDo you want to export again anyway? This will create a new sheet.`;

            if (!confirm(confirmMessage)) {
                console.log("Export cancelled by user - data already exists for today.");
                alert("Export cancelled. Today's data has already been exported.");
                return;
            }
        }

        console.log("Fetching lists...");
        const url = "https://api-prod-client.heymarket.com/v4/lists/fetch";
        const body = {
            filter: "MY",
            archived: false,
            ascending: false,
            order: "updated",
            team_id: TEAM_ID,
            type: "lists",
            resetLocalList: true,
            date: new Date().toISOString()
        };

        try {
            const response = await fetchWithToken(url, { body: JSON.stringify(body) });
            listData = response.lists;
            console.log(`Found ${listData.length} lists.`);
            await fetchBroadcasts(response.broadcasts);
        } catch (error) {
            console.error("Error fetching lists:", error);
        }
    }

    async function fetchBroadcasts(broadcasts) {
        console.log("Processing broadcasts...");
        const reportPromises = broadcasts.map(b => processBroadcast(b));
        totalReportsToProcess = reportPromises.length;
        await Promise.all(reportPromises);
        console.log("All broadcasts processed. Sending to Google Sheets.");
        await sendToGoogleSheets();
    }

    async function processBroadcast(broadcast) {
        if (processedLists.has(broadcast.id)) {
            console.log(`Skipping broadcast ${broadcast.id} as it's already been processed.`);
            return;
        }
        processedLists.add(broadcast.id);

        console.log(`Fetching report for broadcast ID: ${broadcast.id}`);
        const url = "https://api-prod-client.heymarket.com/v2/broadcast/report";
        const body = {
            list_id: broadcast.list_id,
            broadcast_id: broadcast.id,
            team_id: TEAM_ID
        };

        const brand = BRAND_MAP[broadcast.inbox_id] || 'Unknown Brand';

        try {
            const report = await fetchWithToken(url, { body: JSON.stringify(body) });
            const listInfo = listData.find(l => l.id === broadcast.list_id) || {};

            const contactPromises = report.contacts.map(contact => processContact(contact, brand, listInfo, broadcast.date));
            const results = await Promise.all(contactPromises);
            allData = allData.concat(results);
            reportsProcessed++;
            console.log(`Processed ${reportsProcessed} of ${totalReportsToProcess} reports.`);
        } catch (error) {
            console.error(`Error fetching report for broadcast ${broadcast.id}:`, error);
        }
    }

    async function processContact(contact, brand, listInfo, initialSendTime) {
        const number = formatPhoneNumber(contact.target);
        const contactInfo = listInfo.targets?.[contact.target] || {};
        const fname = contactInfo.f || "N/A";
        const lname = contactInfo.l || "N/A";
        const failed = contact.status === "failed" ? "X" : "";
        const hasResponse = contact.response_time !== "0001-01-01T00:00:00Z" ? "X" : "";
        const responseTime = hasResponse === "X" ? new Date(contact.response_time).toLocaleString('en-US', { timeZone: 'America/Chicago' }) : "";

        let conversation = [];
        if (hasResponse === "X" && contact.conversation_id) {
            conversation = await fetchConversation(contact.conversation_id);
        }

        const row = [
            brand,
            fname,
            lname,
            number,
            new Date(initialSendTime).toLocaleString('en-US', { timeZone: 'America/Chicago' }),
            failed,
            hasResponse,
            responseTime
        ];

        // Add conversation messages
        for (let i = 0; i < MAX_CONVERSATION_MESSAGES; i++) {
            row.push(conversation[i] || "");
        }

        return row;
    }

    async function fetchConversation(conversationId) {
        const url = "https://api-prod-client.heymarket.com/v2/messages/fetch";
        const body = {
            parent_id: conversationId,
            team_id: TEAM_ID,
            date: new Date().toISOString(),
            filter: "ALL",
            ascending: false,
            type: "messages"
        };
        const messages = [];

        try {
            const response = await fetchWithToken(url, { body: JSON.stringify(body) });
            const conversationMessages = response.messages
                .filter(m => m.type === 'text')
                .reverse()
                .map(m => {
                    const direction = m.sender === m.target ? "-> You" : "You ->";
                    return `${direction}: ${m.text}`;
                });
            messages.push(...conversationMessages);
        } catch (error) {
            console.error(`Error fetching conversation ${conversationId}:`, error);
        }
        return messages;
    }

    function createUI() {
        const button = document.createElement('button');
        button.innerText = 'Run Heymarket Scraper';
        Object.assign(button.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '10000',
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
        });

        button.addEventListener('click', () => {
            console.log("Starting Heymarket data scrape...");
            allData = []; // Clear previous data
            processedLists = new Set();
            reportsProcessed = 0;
            totalReportsToProcess = 0;
            fetchLists();
        });

        document.body.appendChild(button);
    }

    createUI();
})();