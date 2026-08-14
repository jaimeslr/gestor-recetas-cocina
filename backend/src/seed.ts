import { store } from './db.js';
import { hashPassword } from './auth.js';

interface SampleUser {
  email: string;
  publicName: string;
  bio: string;
  avatarColor: string;
  password: string;
}

interface SampleIngredient {
  name: string;
  quantity: number;
  unit: string;
}

interface SampleRecipe {
  title: string;
  description: string;
  imagePrompt: string;
  category: string;
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  difficulty: string;
  diets: string[];
  allergens: string[];
  ingredients: SampleIngredient[];
  steps: string[];
}

const SAMPLE_RECIPES: SampleRecipe[] = [
  {
    title: 'Tortilla de patatas clásica',
    description: 'Tortilla española esponjosa con cebolla caramelizada.',
    imagePrompt: 'Spanish tortilla',
    category: 'comida',
    prepMinutes: 10,
    cookMinutes: 25,
    servings: 4,
    difficulty: 'facil',
    diets: ['vegetariana'],
    allergens: ['huevos'],
    ingredients: [
      { name: 'Patatas', quantity: 600, unit: 'g' },
      { name: 'Huevos', quantity: 6, unit: 'ud' },
      { name: 'Cebolla', quantity: 1, unit: 'ud' },
      { name: 'Aceite de oliva', quantity: 120, unit: 'ml' },
      { name: 'Sal', quantity: 1, unit: 'cdita' },
    ],
    steps: [
      'Pela y corta las patatas en láminas finas.',
      'Sofríe las patatas con la cebolla a fuego medio durante 15 minutos.',
      'Bate los huevos con sal y mezcla con las patatas escurridas.',
      'Cuaja la tortilla a fuego suave por ambos lados.',
    ],
  },
  {
    title: 'Ensalada de quinoa mediterránea',
    description: 'Ensalada fresca con verduras de temporada, garbanzos y vinagreta de limón.',
    imagePrompt: 'Mediterranean quinoa salad',
    category: 'comida',
    prepMinutes: 15,
    cookMinutes: 15,
    servings: 4,
    difficulty: 'facil',
    diets: ['vegetariana', 'vegana', 'sin_lactosa', 'mediterranea'],
    allergens: [],
    ingredients: [
      { name: 'Quinoa', quantity: 200, unit: 'g' },
      { name: 'Pepino', quantity: 1, unit: 'ud' },
      { name: 'Tomate cherry', quantity: 200, unit: 'g' },
      { name: 'Garbanzos cocidos', quantity: 250, unit: 'g' },
      { name: 'Perejil', quantity: 1, unit: 'pizca' },
      { name: 'Limón', quantity: 1, unit: 'ud' },
    ],
    steps: [
      'Cocer la quinoa en agua con sal durante 12 minutos.',
      'Picar las verduras y mezclar con la quinoa fría.',
      'Aliñar con limón, aceite, sal y perejil.',
    ],
  },
  {
    title: 'Crema de calabaza asada',
    description: 'Crema suave de calabaza asada con un toque de jengibre.',
    imagePrompt: 'Pumpkin soup',
    category: 'cena',
    prepMinutes: 10,
    cookMinutes: 40,
    servings: 4,
    difficulty: 'facil',
    diets: ['vegetariana', 'vegana', 'sin_lactosa'],
    allergens: [],
    ingredients: [
      { name: 'Calabaza', quantity: 800, unit: 'g' },
      { name: 'Cebolla', quantity: 1, unit: 'ud' },
      { name: 'Jengibre fresco', quantity: 1, unit: 'diente' },
      { name: 'Caldo de verduras', quantity: 500, unit: 'ml' },
      { name: 'Aceite de oliva', quantity: 30, unit: 'ml' },
    ],
    steps: [
      'Asar la calabaza cortada en dados durante 25 minutos.',
      'Pochar la cebolla y el jengibre, añadir la calabaza.',
      'Cubrir con caldo y triturar hasta obtener crema.',
    ],
  },
  {
    title: 'Pasta al pesto casero',
    description: 'Pasta con pesto de albahaca fresca, piñones y parmesano.',
    imagePrompt: 'Pasta pesto',
    category: 'comida',
    prepMinutes: 10,
    cookMinutes: 15,
    servings: 4,
    difficulty: 'facil',
    diets: ['vegetariana'],
    allergens: ['gluten', 'frutos_cascara', 'leche'],
    ingredients: [
      { name: 'Pasta', quantity: 400, unit: 'g' },
      { name: 'Albahaca', quantity: 60, unit: 'g' },
      { name: 'Piñones', quantity: 40, unit: 'g' },
      { name: 'Parmesano', quantity: 60, unit: 'g' },
      { name: 'Aceite de oliva', quantity: 80, unit: 'ml' },
    ],
    steps: [
      'Cocer la pasta según las instrucciones.',
      'Triturar albahaca, piñones, parmesano y aceite.',
      'Mezclar con la pasta caliente y servir.',
    ],
  },
  {
    title: 'Pollo al curry con arroz',
    description: 'Pollo tierno en salsa de curry con leche de coco y arroz basmati.',
    imagePrompt: 'Chicken curry',
    category: 'comida',
    prepMinutes: 15,
    cookMinutes: 30,
    servings: 4,
    difficulty: 'media',
    diets: ['sin_lactosa'],
    allergens: ['pescado'],
    ingredients: [
      { name: 'Pechuga de pollo', quantity: 600, unit: 'g' },
      { name: 'Leche de coco', quantity: 400, unit: 'ml' },
      { name: 'Pasta de curry', quantity: 2, unit: 'cdita' },
      { name: 'Arroz basmati', quantity: 300, unit: 'g' },
      { name: 'Cebolla', quantity: 1, unit: 'ud' },
    ],
    steps: [
      'Dorar la cebolla y el pollo troceado.',
      'Añadir la pasta de curry y la leche de coco.',
      'Cocinar 15 minutos y servir con arroz cocido.',
    ],
  },
  {
    title: 'Tacos de pescado al limón',
    description: 'Tacos de pescado blanco con salsa de yogur y cilantro.',
    imagePrompt: 'Fish tacos',
    category: 'cena',
    prepMinutes: 15,
    cookMinutes: 10,
    servings: 4,
    difficulty: 'media',
    diets: ['pescetariana'],
    allergens: ['pescado', 'leche', 'gluten'],
    ingredients: [
      { name: 'Filetes de merluza', quantity: 500, unit: 'g' },
      { name: 'Tortillas de trigo', quantity: 8, unit: 'ud' },
      { name: 'Yogur natural', quantity: 200, unit: 'g' },
      { name: 'Lima', quantity: 1, unit: 'ud' },
      { name: 'Cilantro', quantity: 1, unit: 'pizca' },
    ],
    steps: [
      'Cocinar el pescado a la plancha con lima.',
      'Mezclar yogur con cilantro y ralladura de lima.',
      'Servir en tortillas con la salsa.',
    ],
  },
  {
    title: 'Brownie de chocolate sin gluten',
    description: 'Brownie húmedo con harina de almendras y chocolate negro.',
    imagePrompt: 'Brownie',
    category: 'postre',
    prepMinutes: 15,
    cookMinutes: 25,
    servings: 8,
    difficulty: 'media',
    diets: ['vegetariana', 'sin_gluten'],
    allergens: ['huevos', 'frutos_cascara', 'leche'],
    ingredients: [
      { name: 'Chocolate negro', quantity: 200, unit: 'g' },
      { name: 'Mantequilla', quantity: 120, unit: 'g' },
      { name: 'Huevos', quantity: 3, unit: 'ud' },
      { name: 'Harina de almendras', quantity: 100, unit: 'g' },
      { name: 'Azúcar', quantity: 150, unit: 'g' },
    ],
    steps: [
      'Fundir chocolate con mantequilla.',
      'Batir huevos y azúcar, añadir la harina.',
      'Mezclar y hornear a 180°C durante 20 minutos.',
    ],
  },
  {
    title: 'Gazpacho andaluz',
    description: 'Gazpacho tradicional con tomate, pepino y pimiento.',
    imagePrompt: 'Gazpacho',
    category: 'cena',
    prepMinutes: 15,
    cookMinutes: 0,
    servings: 4,
    difficulty: 'facil',
    diets: ['vegetariana', 'vegana', 'sin_lactosa', 'mediterranea'],
    allergens: ['gluten'],
    ingredients: [
      { name: 'Tomate maduro', quantity: 800, unit: 'g' },
      { name: 'Pepino', quantity: 1, unit: 'ud' },
      { name: 'Pimiento verde', quantity: 1, unit: 'ud' },
      { name: 'Pan duro', quantity: 50, unit: 'g' },
      { name: 'Aceite de oliva', quantity: 60, unit: 'ml' },
    ],
    steps: [
      'Triturar todos los ingredientes hasta obtener textura fina.',
      'Colar y servir muy frío.',
    ],
  },
  {
    title: 'Tostadas de aguacate y huevo',
    description: 'Pan integral con aguacate, huevo pochado y semillas.',
    imagePrompt: 'Avocado toast',
    category: 'desayuno',
    prepMinutes: 5,
    cookMinutes: 5,
    servings: 2,
    difficulty: 'facil',
    diets: ['vegetariana'],
    allergens: ['gluten', 'huevos'],
    ingredients: [
      { name: 'Pan integral', quantity: 4, unit: 'rebanada' },
      { name: 'Aguacate', quantity: 2, unit: 'ud' },
      { name: 'Huevos', quantity: 2, unit: 'ud' },
      { name: 'Semillas de sésamo', quantity: 1, unit: 'cdita' },
    ],
    steps: [
      'Tostar el pan y untar aguacate.',
      'Pochar los huevos y colocar sobre el pan.',
      'Terminar con sésamo y sal.',
    ],
  },
  {
    title: 'Risotto de setas',
    description: 'Risotto cremoso con setas variadas y parmesano.',
    imagePrompt: 'Mushroom risotto',
    category: 'comida',
    prepMinutes: 10,
    cookMinutes: 30,
    servings: 4,
    difficulty: 'media',
    diets: ['vegetariana'],
    allergens: ['leche'],
    ingredients: [
      { name: 'Arroz arborio', quantity: 320, unit: 'g' },
      { name: 'Setas variadas', quantity: 400, unit: 'g' },
      { name: 'Caldo de verduras', quantity: 1000, unit: 'ml' },
      { name: 'Parmesano', quantity: 80, unit: 'g' },
      { name: 'Cebolla', quantity: 1, unit: 'ud' },
    ],
    steps: [
      'Saltear las setas y reservar.',
      'Pochar la cebolla, añadir el arroz y tostar.',
      'Incorporar el caldo poco a poco removiendo.',
      'Añadir setas y parmesano al final.',
    ],
  },
  {
    title: 'Hummus de garbanzos',
    description: 'Hummus cremoso con tahini y limón.',
    imagePrompt: 'Hummus',
    category: 'guarnicion',
    prepMinutes: 10,
    cookMinutes: 0,
    servings: 6,
    difficulty: 'facil',
    diets: ['vegetariana', 'vegana', 'sin_lactosa', 'mediterranea'],
    allergens: ['sesamo'],
    ingredients: [
      { name: 'Garbanzos cocidos', quantity: 400, unit: 'g' },
      { name: 'Tahini', quantity: 60, unit: 'g' },
      { name: 'Limón', quantity: 1, unit: 'ud' },
      { name: 'Ajo', quantity: 1, unit: 'diente' },
      { name: 'Aceite de oliva', quantity: 40, unit: 'ml' },
    ],
    steps: [
      'Triturar todos los ingredientes hasta obtener crema.',
      'Ajustar de sal y limón.',
    ],
  },
  {
    title: 'Lentejas estofadas',
    description: 'Lentejas guisadas con verduras y chorizo.',
    imagePrompt: 'Lentil stew',
    category: 'comida',
    prepMinutes: 15,
    cookMinutes: 40,
    servings: 4,
    difficulty: 'facil',
    diets: ['sin_lactosa'],
    allergens: [],
    ingredients: [
      { name: 'Lentejas', quantity: 300, unit: 'g' },
      { name: 'Zanahoria', quantity: 2, unit: 'ud' },
      { name: 'Cebolla', quantity: 1, unit: 'ud' },
      { name: 'Chorizo', quantity: 100, unit: 'g' },
      { name: 'Caldo de verduras', quantity: 800, unit: 'ml' },
    ],
    steps: [
      'Pochar las verduras y el chorizo.',
      'Añadir las lentejas y el caldo.',
      'Cocer a fuego medio 30 minutos.',
    ],
  },
];

const SAMPLE_USERS: SampleUser[] = [
  {
    email: 'lucia@example.com',
    publicName: 'Lucía',
    bio: 'Cocinera hogareña, recetas de la abuela.',
    avatarColor: '#f97316',
    password: 'Demo1234',
  },
  {
    email: 'ivan@example.com',
    publicName: 'Iván',
    bio: 'Cocinero aficionado, batch cooking y panes.',
    avatarColor: '#10b981',
    password: 'Demo1234',
  },
  {
    email: 'ana@example.com',
    publicName: 'Ana',
    bio: 'Recetas sin gluten y sin frutos secos.',
    avatarColor: '#6366f1',
    password: 'Demo1234',
  },
];

export function seedIfEmpty(): void {
  if (store.listRecipes().length > 0) return;
  const users = SAMPLE_USERS.map((sample) => {
    const user = store.createUser({
      email: sample.email,
      passwordHash: hashPassword(sample.password),
      publicName: sample.publicName,
      bio: sample.bio,
      avatarColor: sample.avatarColor,
      verifiedAt: new Date().toISOString(),
    });
    store.createCollection({ userId: user.id, name: 'Favoritas' });
    return user;
  });

  store.follow({ followerId: users[0].id, followedId: users[1].id });
  store.follow({ followerId: users[0].id, followedId: users[2].id });
  store.follow({ followerId: users[1].id, followedId: users[0].id });

  SAMPLE_RECIPES.forEach((recipe, idx) => {
    const author = users[idx % users.length];
    store.createRecipe({
      title: recipe.title,
      description: recipe.description,
      imagePrompt: recipe.imagePrompt,
      category: recipe.category as never,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      servings: recipe.servings,
      difficulty: recipe.difficulty as never,
      diets: recipe.diets,
      allergens: recipe.allergens,
      ingredients: recipe.ingredients.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit as never,
      })),
      steps: recipe.steps.map((text, order) => ({ order: order + 1, text })),
      authorId: author.id,
    });
  });

  const recipes = store.listRecipes();
  const someone = (i: number) => users[i % users.length];
  store.setRating({ userId: someone(1).id, recipeId: recipes[0].id, stars: 5 });
  store.setRating({ userId: someone(2).id, recipeId: recipes[0].id, stars: 4 });
  store.setRating({ userId: someone(0).id, recipeId: recipes[3].id, stars: 5 });
  store.setRating({ userId: someone(1).id, recipeId: recipes[3].id, stars: 4 });
  store.setRating({ userId: someone(2).id, recipeId: recipes[6].id, stars: 5 });
  store.setRating({ userId: someone(0).id, recipeId: recipes[7].id, stars: 5 });
  store.setRating({ userId: someone(1).id, recipeId: recipes[7].id, stars: 5 });
  store.setRating({ userId: someone(2).id, recipeId: recipes[7].id, stars: 4 });

  store.saveRecipe({
    userId: someone(0).id,
    recipeId: recipes[1].id,
    collectionId: store.listCollections(someone(0).id)[0].id,
  });
  store.saveRecipe({
    userId: someone(1).id,
    recipeId: recipes[0].id,
    collectionId: store.listCollections(someone(1).id)[0].id,
  });
}
