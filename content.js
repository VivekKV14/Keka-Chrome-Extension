// Example to fetch a JWT token from localStorage
// const token = localStorage.getItem('access_token'); // Update the key if the JWT is stored elsewhere
// console.log(token);

// if (token) {
//   // Call the website's API
//   fetch('https://edfora.keka.com/k/attendance/api/mytime/attendance/summary', {
//     method: 'GET',
//     headers: {
//       Authorization: `Bearer ${token}`,
//       'Content-Type': 'application/json',
//     },
//   })
//     .then((response) => response.json())
//     .then((data) => {
//       console.log('API Response:', data);
//     })
//     .catch((error) => {
//       console.error('Error making API request:', error);
//     });
// } else {
//   console.error('JWT token not found in localStorage');
// }


let currentData;
let lastSync;
function getHoursAndMinutesFromMilliseconds({ milliseconds = 0 }) {
  const totalMinutes = (milliseconds - (milliseconds % (1000 * 60))) / (1000 * 60);
  const hours = (totalMinutes - totalMinutes % 60) / 60;
  const minutes = totalMinutes % 60;
  const formattedString = `${hours}h ${minutes}m`;
  return { hours, minutes, formattedString };
}

const getDisplayMessage = ({ hours, minutes, isSurplus, hoursRemaining, minutesRemaining, totalLeaves }) => {
  return `You've served a total of ${hours}h ${minutes}m with ${
    isSurplus ? `${hoursRemaining}h ${minutesRemaining}m extra served` : `${hoursRemaining}h ${minutesRemaining}m remaining`
  }, and ${
    totalLeaves > 0 ? `${totalLeaves} leave${totalLeaves > 1 ? 's' : ''} or clock-in issue${totalLeaves > 1 ? 's' : ''}` : 'no leaves or clock-in issues'
  }-keep it up!`;
};

const TOTAL_MILLISECONDS_REQUIRED = (days) => (days * 9 * 60 + 1) * 60 * 1000;
const TARGET_URL = '#/me/attendance/logs'

async function getWeeklyData({ authToken }) {
  try {
    if (!authToken) {
      throw 'Invalid token'
    }
    const url = 'https://edfora.keka.com/k/attendance/api/mytime/attendance/summary/';
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authToken,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw `HTTP error! status: ${response.status}`;
    }
    const data = await response.json();
    const logs = (data.data || []);
    logs.reverse();
    let totalMillis = 0;
    let totalDays = 0;
    let totalLeaves = 0;
    const detailedData = {};
    for (const log of logs) {
      const {
        attendanceDate,
        firstLogOfTheDay,
        lastLogOfTheDay,
        effectiveHoursInHHMM,
      } = log;
      const day = new Date(attendanceDate).getDay();
      if (day === 0) {
        break;
      }
      if (!firstLogOfTheDay) {
        totalLeaves += 1;
        continue;
      }
      const startTime = new Date(firstLogOfTheDay).getTime();
      let lastTime = new Date(lastLogOfTheDay).getTime();
      if (firstLogOfTheDay === lastLogOfTheDay) {
        lastTime = new Date().getTime();
      }
      const diff = lastTime - startTime;
      const { formattedString } = getHoursAndMinutesFromMilliseconds({ milliseconds: diff })
      detailedData[attendanceDate] = {
        diff,
        effectiveHoursInHHMM: formattedString,
      }
      totalMillis += diff;
      totalDays += 1;
    }
    const totalMillisRequired = TOTAL_MILLISECONDS_REQUIRED(totalDays);
    const isSurplus = totalMillisRequired < totalMillis;
    const { hours, minutes } = getHoursAndMinutesFromMilliseconds({ milliseconds: totalMillis });
    const { hours: hoursRemaining, minutes: minutesRemaining } = getHoursAndMinutesFromMilliseconds({ milliseconds: Math.abs(totalMillisRequired - totalMillis) });
    console.log('Total', `${hours}h ${minutes}m`);
    console.log(`${isSurplus ? 'Extra Time' : 'Time Remaining'}`, `${hoursRemaining}h ${minutesRemaining}m`);
    console.log('Total Leaves Or Missing Clock In', totalLeaves);
    console.log('detailedData', detailedData);
    const message = getDisplayMessage({ hours, minutes, isSurplus, hoursRemaining, minutesRemaining, totalLeaves });
    console.log(message);
    return message;
  } catch (error) {
    console.error(error);
  }
}

async function getData() {
  const currTime = new Date();
  if (!lastSync || (currTime - lastSync) > 60000) {
    let authToken = localStorage.getItem('access_token');
    authToken = `Bearer ${authToken}`;
    const data = await getWeeklyData({authToken});
    currentData = data;
    lastSync = new Date();
  }
  remoteDivToPage();
  addDivToPage();
  // chrome.runtime.sendMessage({ type: "keka-data", data: data });
}

getData();


function monitorUrlChanges() {
  let lastUrl = location.pathname;
  const checkUrlChange = () => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      if (currentUrl.includes(TARGET_URL)) {
        getData();
      } else {
        remoteDivToPage()
      } 
    }
  };
  const observer = new MutationObserver(checkUrlChange);
  observer.observe(document, { childList: true, subtree: true });
}

function addDivToPage() {
  const div = document.createElement('div');
  div.id = 'custom-data-div';
  div.style.position = 'fixed';
  div.style.bottom = '10px';
  div.style.right = '10px';
  div.style.padding = '10px';
  div.style.backgroundColor = 'lightblue';
  div.innerHTML = currentData;
  document.body.appendChild(div);
}

function remoteDivToPage() {
  const div = document.getElementById('custom-data-div');
  if(div) {
    document.body.removeChild(div);
  }
}

monitorUrlChanges();

window.addEventListener('focus', () => {
  getData();
})