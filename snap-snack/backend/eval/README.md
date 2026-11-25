# Photo-model test

Decides which Claude model reads Snap Snack's photos by measuring accuracy and real cost on meals you weighed.

## 1. Collect 30+ meals (the more variety, the better)

For each meal:

1. Weigh each part on a kitchen scale before eating.
2. Look up its nutrition (package label, or USDA FoodData Central for fresh food) and add up the meal's calories, protein, carbs and fat.
3. Take one photo the way a user would: phone in hand, plate in view.

Mix it up: single foods, mixed plates, bowls, drinks, restaurant meals, packaged snacks, a few hard ones (casseroles, sauces, smoothies).

## 2. Put them here

- Photos go in `photos/` (JPEG, PNG or WebP, under 5 MB each).
- One row per meal in `meals.csv`:

```
photo,cal,protein,carbs,fat,notes
chicken-rice.jpg,612,48,62,14,5 oz chicken + 1 cup rice + broccoli
latte.jpg,220,12,18,11,16 oz whole milk
```

## 3. Run it

```
npm install
npx tsx compare-models.ts
```

It uses your Anthropic API key (`ANTHROPIC_API_KEY`). 30 meals × 3 models costs roughly $1–3.

The summary shows, per model: average and median calorie error, macro error, real cost per photo, seconds per photo, and failures. Per-photo detail goes to `results.csv`. Photos and results stay on your computer (git ignores them).

## Choosing

Pick the cheapest model whose median calorie error is close to the best one's (within about 5 points), then set it on the server:

```
supabase secrets set SNAP_MODEL=claude-haiku-5-5
```
