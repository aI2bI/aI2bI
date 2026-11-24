# Snap Snack

Snap a photo of any food. Snap Snack itemizes every item (calories, protein, carbs, fat, plus sat fat, fiber, sugars, sodium), files it under the right meal by time of day, and updates your daily, weekly and monthly progress instantly.

Open `snap-snack/index.html` in a browser. It is one self-contained file.

- **Photo AI**: inside Claude it uses Claude directly. Opened as a plain file, paste an Anthropic API key under *Targets → Photo AI* (kept only in your browser). Without AI you can still add items from the built-in food list.
- **Voice / typed commands**: "I had two eggs and toast", "change the rice to half a cup", "delete the cookie", "set protein to 150", "switch to high protein", "I drank 500 ml of water", "my weight is 172", "undo".
- **Views**: Today (Nutrition Facts label, calorie curve vs. pace, insights, meals, water), Week (bars vs. target with trend slope, macro stack, daily log), Month (30-day curve with 7-day average, target calendar, weight trend), Targets (edit every number, macro plans, Mifflin-St Jeor target suggestions, export/import).

## Added in v2
- **Gallery**: photo timeline, newest first, with each day's grade and calories vs. target. Tap any photo for its full nutrition caption (every nutrient as % of your daily targets, per-item grades, minutes of walking to burn it off). Filter by grade.
- **Grades**: every item, meal and day gets a letter grade (A+ to F) and a percentage. Item grades reward protein and fiber per calorie and mark down sugar, saturated fat and sodium. The day grade blends food quality (60%) with staying on plan (40%).
- **Burn**: resting baseline (Mifflin-St Jeor), eight activity modes from resting to high intensity with heart-rate ranges (max HR = 208 − 0.7 × age, plus your resting HR), MET values from the Compendium of Physical Activities, burn per hour for you vs. a 70 kg average adult, an activity log, and a "my heart rate is…" mode finder.
- **Coach**: personal greeting with your projected deficit, plus three intake/output combos: Stay cruising (your goal), Above and beyond (+250), Barry Bonds (1,000).
- **Progress**: metric gallery with 14-day sparklines, energy balance, deficit bank converted to pounds (3,500 kcal ≈ 1 lb), grade trend vs. the US Healthy Eating Index average (≈58), you vs. the average American, and calories by meal.
- US averages are approximate (NHANES/WWEIA 2017–2018, CDC).
