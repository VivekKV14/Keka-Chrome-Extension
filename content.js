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

function getFormattedTime({ dateObj }) {
  let suffix = 'AM';
  let hours = dateObj.getHours();
  let mins = `${dateObj.getMinutes()}`;
  if (hours >= 12) {
    suffix = 'PM';
    hours = hours % 12 || 12;
  }
  if (mins.length === 1) {
    mins = `0${mins}`;
  }
  return `${hours}:${mins} ${suffix}`;
}

const getDisplayMessage = ({ hours, minutes, isSurplus, hoursRemaining, minutesRemaining, totalLeaves, milliseconds }) => {
  const logoutTime = new Date(new Date().getTime() + milliseconds);
  const formattedLogoutTime = getFormattedTime({ dateObj: logoutTime });
  return `You've served a total of ${hours}h ${minutes}m with ${
    isSurplus ? `${hoursRemaining}h ${minutesRemaining}m extra served` : `${hoursRemaining}h ${minutesRemaining}m remaining (please leave at ${formattedLogoutTime})`
  }. ${
    totalLeaves > 0 ? `${totalLeaves} leave${totalLeaves > 1 ? 's' : ''} or clock-in issue${totalLeaves > 1 ? 's' : ''}` : 'No leaves or clock-in issues - keep it up!'
  }`;
};

const TOTAL_MILLISECONDS_REQUIRED = (days) => (days * 9 * 60 + 1) * 60 * 1000;
const HALF_DAY_PENALTY_MINUTES = 11 * 60 + 30;
const TARGET_URL = '#/me/attendance/logs';

function isLateLogin({ firstLogOfTheDay }) {
  const loginHours = new Date(firstLogOfTheDay).getHours();
  const loginMinutes = new Date(firstLogOfTheDay).getMinutes();
  const totalLoginMinutes = loginHours * 60 + loginMinutes;
  return (totalLoginMinutes > HALF_DAY_PENALTY_MINUTES)
}

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
    for (const ind in logs) {
      const log = logs[ind];
      const {
        attendanceDate,
        firstLogOfTheDay,
        lastLogOfTheDay,
        leaveDayStatuses = [],
      } = log;
      const day = new Date(attendanceDate).getDay();
      if (day === 0) {
        break;
      }
      if (!firstLogOfTheDay || (ind !== '0' && (firstLogOfTheDay === lastLogOfTheDay))) {
        totalLeaves += 1;
        continue;
      }
      if (leaveDayStatuses.includes(2) || leaveDayStatuses.includes(3) || isLateLogin({ firstLogOfTheDay })) {
        totalLeaves += 0.5;
        totalDays -= 0.5;
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
    const milliseconds = Math.abs(totalMillisRequired - totalMillis);
    const { hours, minutes } = getHoursAndMinutesFromMilliseconds({ milliseconds: totalMillis });
    const { hours: hoursRemaining, minutes: minutesRemaining } = getHoursAndMinutesFromMilliseconds({ milliseconds });
    console.log('Total', `${hours}h ${minutes}m`);
    console.log(`${isSurplus ? 'Extra Time' : 'Time Remaining'}`, `${hoursRemaining}h ${minutesRemaining}m`);
    console.log('Total Leaves Or Missing Clock In', totalLeaves);
    console.log('detailedData', detailedData);
    const message = getDisplayMessage({ hours, minutes, isSurplus, hoursRemaining, minutesRemaining, totalLeaves, milliseconds });
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

// getData();


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
  div.style.color = 'black';
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

// monitorUrlChanges();

// window.addEventListener('focus', () => {
//   getData();
// })

const authToken = 'Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjFBRjQzNjk5RUE0NDlDNkNCRUU3NDZFMjhDODM5NUIyMEE0MUNFMTgiLCJ4NXQiOiJHdlEybWVwRW5HeS01MGJpaklPVnNncEJ6aGciLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FwcC5rZWthLmNvbSIsIm5iZiI6MTczNzcwMzk2OCwiaWF0IjoxNzM3NzAzOTY4LCJleHAiOjE3Mzc3OTAzNjgsImF1ZCI6WyJrZWthaHIuYXBpIiwiaGlyby5hcGkiLCJodHRwczovL2FwcC5rZWthLmNvbS9yZXNvdXJjZXMiXSwic2NvcGUiOlsib3BlbmlkIiwia2VrYWhyLmFwaSIsImhpcm8uYXBpIiwib2ZmbGluZV9hY2Nlc3MiXSwiYW1yIjpbInB3ZCJdLCJjbGllbnRfaWQiOiI5ODdjYzk3MS1mYzIyLTQ0NTQtOTlmOS0xNmMwNzhmYTdmZjYiLCJzdWIiOiJmNWYxODMzOS0wNWUzLTQ0ZjUtOTFiMy1iZmU3ZDA5NjM1YTciLCJhdXRoX3RpbWUiOjE3MzU4MDIyNzIsImlkcCI6ImxvY2FsIiwidGVuYW50X2lkIjoiODUwOWVmMmMtYWYwYS00M2I5LTg2MjItMDQ5NGM5YjVlM2NjIiwidGVuYW50aWQiOiI4NTA5ZWYyYy1hZjBhLTQzYjktODYyMi0wNDk0YzliNWUzY2MiLCJzdWJkb21haW4iOiJlZGZvcmEua2VrYS5jb20iLCJ1c2VyX2lkIjoiOGI1YTgyOTQtZGU2Mi00NGEzLWE4OTktY2EyM2Y1MGRiMGYyIiwidXNlcl9pZGVudGlmaWVyIjoiOGI1YTgyOTQtZGU2Mi00NGEzLWE4OTktY2EyM2Y1MGRiMGYyIiwidXNlcm5hbWUiOiJhdGhhcnZhLmd1cHRhQGVkZm9yYS5jb20iLCJlbWFpbCI6ImF0aGFydmEuZ3VwdGFAZWRmb3JhLmNvbSIsImF1dGhlbnRpY2F0aW9uX3R5cGUiOiIxIiwic2lkIjoiODk3QTdBQkJFRkQzNEMwMEM3RkQwMzc5NTIwMjM1NzciLCJqdGkiOiI3QTE5NTRDOUM3NzQ5OTQyREUwNkVGNDM1RERGMzc5RiJ9.J2FRaZU4ZV--4p2EbT4fzACz34rB5_eCACxafqUyC4lkr6-KTFjAmrg5CTG-EdjSbxWwjbxPgqNkqVHGozSJ4-_w_9mTUbcLNyKK1ru4_Tva7sddSgkjInueB5AkPnC3dPg3fWRZwddblm9TgD7iCrVytzU53LSxEA3wO16ehsngf_TLPqLIi6qyr-m8WG2NzpFlMHamCgd76C5ElGkEhOy9m0rTYB2TJDNXTOkPp51vQUSwGr9us-V2HYxz4K7N3Pmm0l6sGJVjcOt5eIIvysG5dNzO1wxbNXGRI6dxPthvT9iYBwr7G3EBvLCIbg6c5p4sGVgF5jn9q4bVFYC9VA';
getWeeklyData({ authToken })