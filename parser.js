const axios = require('axios');
const cheerio = require('cheerio');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;

const MONTHS = {
    'январь': 1, 'февраль': 2, 'март': 3, 'апрель': 4,
    'май': 5, 'июнь': 6, 'июль': 7, 'август': 8,
    'сентябрь': 9, 'октябрь': 10, 'ноябрь': 11, 'декабрь': 12
};

const MONTH_NAMES = Object.keys(MONTHS);

async function fetchPage() {
    const response = await axios.get('https://my-calend.ru/holidays/2026', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    return cheerio.load(response.data);
}

function parseHolidays($, section, monthName) {
    const holidays = [];
    const table = $(section).find('.holidays-month-items');
    
    if (!table.length) return holidays;
    
    table.find('tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 2) return;
        
        const dateText = $(cells[0]).text().trim();
        const dateMatch = dateText.match(/^(\d{1,2})\s+/);
        if (!dateMatch) return;
        
        const day = parseInt(dateMatch[1]);
        const monthNumber = MONTHS[monthName.toLowerCase()];
        const formattedDate = `${day.toString().padStart(2, '0')}-${monthNumber.toString().padStart(2, '0')}`;
        
        const holidayItems = [];
        $(cells[1]).find('div').each((_, div) => {
            const holidayLink = $(div).find('a');
            let holidayName = holidayLink.length 
                ? holidayLink.text().trim() 
                : $(div).text().trim().replace(/\s+/g, ' ');
            
            // фильтруем техническую информацию
            if (holidayName && holidayName.length > 2 &&
                !holidayName.match(/\d+\s+день/) &&
                !holidayName.match(/^\d+\s*$/)) {
                holidayItems.push(holidayName);
            }
        });
        
        if (holidayItems.length > 0) {
            holidays.push({
                day,
                month: monthName,
                month_number: monthNumber,
                holidays: holidayItems,
                full_date_formatted: formattedDate,
                full_date_text: `${day} ${monthName}`,
                year: 2026
            });
        }
    });
    
    return holidays;
}

async function quickParse() {
    
    try {
        const $ = await fetchPage();
        const results = [];
        
        $('section').each((_, section) => {
            const monthName = $(section).find('.h2').first().text().trim();
            
            if (!MONTH_NAMES.includes(monthName.toLowerCase())) {
                return;
            }
            
            const monthHolidays = parseHolidays($, section, monthName);
            results.push(...monthHolidays);
        });
        
        console.log(`\nНайдено ${results.length} дат с праздниками`);
        
        if (results.length === 0) {
            console.log('\nНе удалось найти данные. Проверьте структуру сайта.');
            return;
        }
        
        // вывод статистики
        const monthStats = {};
        results.forEach(item => {
            monthStats[item.month] = (monthStats[item.month] || 0) + 1;
        });
        
        console.log('\nСтатистика по месяцам:');
        Object.entries(monthStats).forEach(([month, count]) => {
            console.log(`${month}: ${count} дней с праздниками`);
        });
        
        // сохранение данных
        await Promise.all([
            saveToSQLite(results),
            saveToJson(results)
        ]);
        
        console.log('\nДанные успешно сохранены!');
        
    } catch (error) {
        console.error('Ошибка парсинга:', error.message);
        if (error.response) {
            console.error('Статус:', error.response.status);
        }
    }
}

async function saveToJson(data) {
    await fs.writeFile('holidays_online_2026.json', JSON.stringify(data, null, 2));
    console.log('\nДанные сохранены в holidays_online_2026.json');
}

async function saveToSQLite(data) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database('holidays_2026.db');
        
        db.serialize(() => {
            db.run(
                `CREATE TABLE IF NOT EXISTS holidays_2026 (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    day INTEGER NOT NULL,
                    month TEXT NOT NULL,
                    month_number INTEGER NOT NULL,
                    holidays TEXT NOT NULL,
                    full_date_formatted TEXT NOT NULL UNIQUE,
                    full_date_text TEXT NOT NULL,
                    year INTEGER DEFAULT 2026,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            );
            
            db.run('DELETE FROM holidays_2026');
            
            const stmt = db.prepare(
                `INSERT INTO holidays_2026 
                (day, month, month_number, holidays, full_date_formatted, full_date_text, year) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`
            );
            
            data.forEach(item => {
                stmt.run(
                    item.day,
                    item.month,
                    item.month_number,
                    JSON.stringify(item.holidays),
                    item.full_date_formatted,
                    item.full_date_text,
                    item.year
                );
            });
            
            stmt.finalize();
        });
        
        db.close(err => {
            if (err) reject(err);
            else {
                console.log('Данные сохранены в SQLite (holidays_2026.db)');
                resolve();
            }
        });
    });
}

async function checkDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database('holidays_2026.db');
        
        db.get('SELECT COUNT(*) as count FROM holidays_2026', (err, row) => {
            if (err) reject(err);
            console.log(`\nВ базе данных: ${row.count} записей`);
            
            if (row.count > 0) {
                db.all('SELECT * FROM holidays_2026 ORDER BY month_number, day LIMIT 10', (err, rows) => {
                    if (err) reject(err);

                    db.all('SELECT month, COUNT(*) as count FROM holidays_2026 GROUP BY month ORDER BY month_number', (err, stats) => {
                        if (err) reject(err);
                        
                        db.close();
                        resolve();
                    });
                });
            } else {
                db.close();
                resolve();
            }
        });
    });
}
async function main() {
    console.log('Начат парсинг с my-calend.ru');
    await quickParse();
    await checkDatabase();
}

main();