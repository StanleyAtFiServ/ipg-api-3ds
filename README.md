1. Open the ipg-api-3ds folder by vsCode
2. Edit field in .env file based on FiServ providing API credential and merchant public call-back URL.
        FISERV_API_KEY=
        FISERV_API_SECRET=
        FISERV_STORE_ID=
        BASE_URL=
3. On terminal, run command "npm install"
4. On vsCode, select server.js, select "Run->Start with(/without) Debugging"
5. On browser, enter URL "http://localhost:3000/checkout.html"
6. Publishing a URL connecting to your localhost:3000 (Use merchant own method)
7. Ready to start 3DS transaction on browser.
