# גלריית תכשיטים

אתר גלריה פשוט עם לוח ניהול — מתאים לתצוגת תכשיטים לפי קטגוריות.

## הפעלה מקומית (על המחשב)

1. **התקן Node.js** מ-https://nodejs.org (אם עדיין לא מותקן)
2. פתח טרמינל בתיקיית הפרויקט
3. הרץ:
   ```
   npm install
   npm start
   ```
4. פתח דפדפן בכתובת: **http://localhost:3000**

## שינוי סיסמת הניהול

פתח את קובץ `.env` ושנה את הערך של `ADMIN_PASSWORD`.

## כתובות

- **גלריה ציבורית:** http://localhost:3000
- **לוח ניהול:** http://localhost:3000/admin.html

## מה אפשר לעשות בלוח הניהול

- העלאת תמונות עם שם, תיאור וקטגוריה
- הוספה ומחיקה של קטגוריות
- מחיקת פריטים

## פרסום באינטרנט (Render.com — חינמי)

1. עלה ל-https://render.com והירשם
2. צור "New Web Service"
3. חבר את הפרויקט מ-GitHub (צריך להעלות לשם קודם)
4. הגדרות:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. הוסף Environment Variable: `ADMIN_PASSWORD=הסיסמה-שלך`
