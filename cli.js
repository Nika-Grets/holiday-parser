const sqlite3 = require('sqlite3').verbose();

function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}`;
}

function getHolidays(dateStr) {
    return new Promise((resolve, reject) => {
    const db = new sqlite3.Database('holidays_2026.db');
    
    db.get(
        'SELECT holidays FROM holidays_2026 WHERE full_date_formatted = ?',
        [dateStr],
        (err, row) => {
        db.close();
        
        if (err) {
            reject(err);
            return;
        }
        
        resolve(row ? JSON.parse(row.holidays) : []);
        }
    );
  });
}

async function main() {
    const args = process.argv.slice(2);
    let targetDate;
  
    if (args.length === 0) {
    // если дата не указана - используем сегодня
    targetDate = new Date();
  } else {
    // парсим дату из формата "dd-mm"
    const [day, month] = args[0].split('-').map(Number);
    const currentYear = new Date().getFullYear();
    targetDate = new Date(currentYear, month - 1, day);
  }
  
  const dateStr = formatDate(targetDate);
  
  console.log(`Дата: ${dateStr}`);
  console.log('-'.repeat(50));
  
  try {
    const holidays = await getHolidays(dateStr);
    
    if (holidays.length === 0) {
        console.log('Праздников на эту дату не найдено');
    } else {
        holidays.forEach((holiday, index) => {
        console.log(`${index + 1}. ${holiday}`);
        });
    }
  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

main();