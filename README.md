This repo includes part of the frontend documents.</br>


<h2>Environment Requirements</h2>

<h3>Basic Dependencies</h3>
• Operating System: Windows/macOS/Linux•Python 3.8+</br>
• Node.js 14.x+ and npm 6.x+</br>
• Network Environment: Local service ports must be accessible</br>

<h3>Required Software</h3>
• Git (optional, for code cloning)</br>
• Web Browser (Chrome/Firefox latest versions recommended)</br>


<h2>Data Requirements</h2>

```python
├─/root/Project Folder
        ├─node_modules
        ├─public
        ├─src
             ├─components
                    ├─ .tsx files 
             ├─data 
             ├─backend (App.py)
             ├─venv
...
```



<h2>Frontend Application Deployment</h2>


<h3>Obtain Frontend Code</h3>
Copy the directory containing React code (ResearchDashboard.tsx, App.tsx, etc.) to the target server:</br>

```python
cd frontend  # Navigate to frontend code directory
```

<h4>Example from MacOS</h4>

```python
cd ../Desktop/../yeshiva-network/src
python -m venv venv
source venv/bin/activate
cd ..
rm -rf node_modules
rm -f package-lock.json yarn.lock
```

<h3>Install Dependencies</h3>

```python
npm install
```

<h3>Configure API Address (if needed)</h3>

If the backend service address is not http://localhost:5000, update the base API URL in the frontend code (e.g., in network-related components):</br>

```python
### Example: Modify base API path
const API_BASE_URL = "http://your-backend-ip:5000/api";
```

<h3>Start Frontend Environment</h3>

```python
npm start
```

The frontend application will run at http://localhost:3000 (default port).

<h2>Operation and Verification</h2>
1.	Ensure the backend service is running (

```python
python app.py
```

2.	Start the frontend application

```python
npm start
```


3.      For macOS, disable AirPlay to avoid port deprecation</br> 
4.	Open a browser and access http://localhost:3000</br>
5.	Verify functionality:</br> 
• Click the homepage button to enter the research dashboard</br>
• Click "View Network Graphs" to view network visualizations</br>









