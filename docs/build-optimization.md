# Оптимизация сборки и решение проблем производительности

## Проблемы и решения

### 1. Медленная сборка

#### Причины медленной сборки:

1. **Конфликт Turbopack/Webpack в Next.js 16**
   - Next.js 16 по умолчанию использует Turbopack
   - При наличии webpack конфигурации возникает конфликт
   - Решение: явно указывать `--webpack` при сборке

2. **Проверка типов TypeScript**
   - TypeScript проверка типов может занимать много времени
   - Решение: использовать `SKIP_TYPE_CHECK=true` для ускорения

3. **Проверка ESLint**
   - ESLint проверка всех файлов замедляет сборку
   - Решение: использовать `SKIP_LINT=true` для пропуска проверки

4. **Большое количество зависимостей**
   - Много библиотек увеличивают время сборки
   - Решение: оптимизация через code splitting

#### Команды для оптимизированной сборки:

```bash
# Стандартная сборка (с webpack)
cd /opt/xray-report-ui/frontend && npm run build

# Быстрая сборка (без проверок)
cd /opt/xray-report-ui/frontend && npm run build:fast

# Сборка с webpack (явно)
cd /opt/xray-report-ui/frontend && npm run build:webpack

# Сборка с Turbopack (экспериментально)
cd /opt/xray-report-ui/frontend && npm run build:turbo
```

#### Рекомендации для сервера:

1. **Используйте быструю сборку для production:**
   ```bash
   cd /opt/xray-report-ui/frontend && npm run build:fast
   ```

2. **Для CI/CD используйте стандартную сборку:**
   ```bash
   cd /opt/xray-report-ui/frontend && npm run build
   ```

3. **Кэширование node_modules:**
   - Убедитесь, что `node_modules` не удаляется между сборками
   - Используйте `.npmrc` для оптимизации установки пакетов

4. **Увеличение памяти для Node.js:**
   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   npm run build
   ```

### 2. Ошибка "Application error: a client-side exception has occurred"

#### Причины ошибки:

1. **Проблемы с SSR/Hydration**
   - Использование `localStorage` и `window` во время SSR
   - Несоответствие между серверным и клиентским рендерингом

2. **Ошибки в ApiStatusChecker**
   - Компонент делает запрос к API при загрузке
   - Если API недоступен, возникает ошибка

3. **Отсутствие проверок на клиентскую среду**
   - Код выполняется на сервере, где нет `window` и `localStorage`

#### Решения (уже применены):

1. **Добавлены проверки на наличие `window` и `localStorage`:**
   ```typescript
   if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
     return;
   }
   ```

2. **Улучшен ApiStatusChecker:**
   - Добавлена проверка монтирования компонента
   - Компонент не блокирует рендеринг до монтирования на клиенте

3. **Безопасное использование localStorage:**
   - Все обращения к `localStorage` обернуты в проверки
   - Код выполняется только на клиенте

### 3. Как избежать проблем в будущем

#### Правила разработки:

1. **Всегда проверяйте наличие `window` и `localStorage`:**
   ```typescript
   if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
     // Использование localStorage
   }
   ```

2. **Используйте `useEffect` для клиентского кода:**
   ```typescript
   useEffect(() => {
     // Код выполняется только на клиенте
   }, []);
   ```

3. **Проверяйте монтирование компонента:**
   ```typescript
   const [mounted, setMounted] = useState(false);
   
   useEffect(() => {
     setMounted(true);
   }, []);
   
   if (!mounted) {
     return null; // или loading state
   }
   ```

4. **Обрабатывайте ошибки API:**
   ```typescript
   try {
     await apiClient.ping();
   } catch (error) {
     // Обработка ошибки без краша приложения
   }
   ```

#### Мониторинг производительности:

1. **Анализ размера бандла:**
   ```bash
   npm run build:analyze
   ```

2. **Проверка времени сборки:**
   ```bash
   time npm run build
   ```

3. **Мониторинг использования памяти:**
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm run build
   ```

### 4. Оптимизация для production

#### Рекомендуемые настройки:

1. **Используйте переменные окружения:**
   ```bash
   export NODE_ENV=production
   export SKIP_TYPE_CHECK=true  # Только если уверены в типах
   export SKIP_LINT=true        # Только если код проверен
   ```

2. **Настройте кэширование:**
   - Кэшируйте `.next` директорию между сборками
   - Используйте Docker layer caching для `node_modules`

3. **Оптимизируйте зависимости:**
   - Удаляйте неиспользуемые зависимости
   - Используйте `optimizePackageImports` в `next.config.ts`

4. **Используйте CDN для статических ресурсов:**
   - Настройте CDN для статических файлов
   - Используйте Next.js Image Optimization

### 5. Отладка проблем

#### Если сборка все еще медленная:

1. **Проверьте размер проекта:**
   ```bash
   du -sh /opt/xray-report-ui/frontend
   du -sh /opt/xray-report-ui/frontend/node_modules
   ```

2. **Проверьте количество файлов:**
   ```bash
   find /opt/xray-report-ui/frontend -type f | wc -l
   ```

3. **Проверьте использование памяти:**
   ```bash
   free -h
   ```

4. **Используйте профилирование:**
   ```bash
   NODE_OPTIONS="--prof" npm run build
   ```

#### Если ошибка клиентской стороны все еще возникает:

1. **Проверьте консоль браузера:**
   - Откройте DevTools
   - Проверьте вкладку Console на наличие ошибок
   - Проверьте вкладку Network на наличие failed requests

2. **Проверьте SSR/Hydration:**
   - Отключите JavaScript в браузере
   - Проверьте, что страница рендерится на сервере

3. **Используйте React DevTools:**
   - Установите React DevTools
   - Проверьте компоненты на наличие ошибок

### 6. Чеклист перед деплоем

- [ ] Сборка проходит без ошибок
- [ ] Нет предупреждений в консоли браузера
- [ ] Все страницы загружаются корректно
- [ ] API запросы работают
- [ ] localStorage работает корректно
- [ ] Нет проблем с SSR/Hydration
- [ ] Производительность приемлемая
- [ ] Размер бандла оптимизирован

## Контакты и поддержка

Если проблемы сохраняются, проверьте:
1. Версию Node.js (рекомендуется 18+)
2. Версию npm (рекомендуется 9+)
3. Доступную память на сервере
4. Логи сборки для деталей ошибок
