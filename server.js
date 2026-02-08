const fastify = require('fastify')({ logger: true });
const sqlite3 = require('sqlite3').verbose();

// настройка CORS для веб-интерфейса
fastify.register(require('@fastify/cors'), {
    origin: '*',
    methods: ['GET']
});

fastify.register(require('@fastify/view'), {
    engine: {
        ejs: require('ejs')
    }
});

const db = new sqlite3.Database('holidays_2026.db');

fastify.get('/api/date/:date', async (request, reply) => {
    const { date } = request.params;
  
    return new Promise((resolve, reject) => {
    db.get(
        'SELECT holidays FROM holidays_2026 WHERE full_date_formatted = ?',
        [date],
        (err, row) => {
            if (err) {
            reply.code(500).send({ error: 'Database error' });
            reject(err);
            return;
        }
        
        if (!row) {
            reply.code(404).send({ error: 'Date not found' });
            resolve();
            return;
        }
        
        const result = {
            date: date,
            holidays: JSON.parse(row.holidays)
        };
        
        reply.send(result);
        resolve();
        }
    );
  });
});

fastify.get('/', async (request, reply) => {
    return reply.view('./views/index.ejs', { 
    title: 'Календарь праздников 2026',
    currentDate: new Date().toLocaleDateString('ru-RU')
  });
});

// результаты
fastify.get('/search', async (request, reply) => {
    const { date } = request.query;

    try {
    const result = await new Promise((resolve, reject) => {
        db.get(
        'SELECT holidays FROM holidays_2026 WHERE full_date_formatted = ?',
        [date],
        (err, row) => {
            if (err) {
            return reject(err);
            }
            resolve(row);
        }
        );
    });

    const holidays = result ? JSON.parse(result.holidays) : [];
    
    return reply.view('./views/result.ejs', { 
        date, 
        holidays,
        found: holidays.length > 0
    });
    
} catch (err) {
    return reply.code(500).view('./views/error.ejs', { 
        error: 'Ошибка базы данных' 
    });
}
});

const start = async () => {
    try {
        await fastify.listen({ port: 12012 });
        console.log('Сервер запущен на http://localhost:12012');
    } catch (err) {
    fastify.log.error(err);
    process.exit(1);
    }
};

start();