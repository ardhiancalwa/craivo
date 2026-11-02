import { PrismaClient, TagDimension } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('--- Starting Idempotent Seeding for Cravio ---')

  // 1. Config Cravio
  const config = await prisma.cravioConfig.upsert({
    where: { id: 'cravio-main-config' },
    update: {
      name: 'Cravio',
      tagline: 'Your craving, Perfectly Matched',
      address: 'Jl. Senopati No. 42, Jakarta Selatan',
      phone: '0812-3456-7890',
      taxRateBps: 0,
      serviceRateBps: 0,
      isTaxInclusive: false,
      currency: 'IDR',
      timezone: 'Asia/Jakarta',
      openingHours: '08:00 - 22:00 WIB',
      qrisTimeoutMinutes: 15,
      cashTimeoutMinutes: 20,
      quizVersion: 1,
    },
    create: {
      id: 'cravio-main-config',
      name: 'Cravio',
      tagline: 'Your craving, Perfectly Matched',
      address: 'Jl. Senopati No. 42, Jakarta Selatan',
      phone: '0812-3456-7890',
      taxRateBps: 0,
      serviceRateBps: 0,
      isTaxInclusive: false,
      currency: 'IDR',
      timezone: 'Asia/Jakarta',
      openingHours: '08:00 - 22:00 WIB',
      qrisTimeoutMinutes: 15,
      cashTimeoutMinutes: 20,
      quizVersion: 1,
    },
  })
  console.log(`[Config] Cravio Config created/updated (${config.name}).`)

  // 2. Tables 01 to 10
  for (let i = 1; i <= 10; i++) {
    const tableNum = i.toString().padStart(2, '0')
    await prisma.table.upsert({
      where: { tableNumber: tableNum },
      update: {
        qrSlug: `sela-table-${tableNum}`,
        isActive: true,
      },
      create: {
        tableNumber: tableNum,
        qrSlug: `sela-table-${tableNum}`,
        isActive: true,
      },
    })
  }
  console.log('[Tables] 10 Cafe Tables (01-10) ensured.')

  // 3. Categories (3 Real Categories; "Semua" is UI-only)
  const catKopi = await prisma.category.upsert({
    where: { slug: 'kopi' },
    update: { name: 'Kopi', sortOrder: 1 },
    create: { name: 'Kopi', slug: 'kopi', sortOrder: 1 },
  })

  const catNonKopi = await prisma.category.upsert({
    where: { slug: 'non-kopi' },
    update: { name: 'Non-Kopi', sortOrder: 2 },
    create: { name: 'Non-Kopi', slug: 'non-kopi', sortOrder: 2 },
  })

  const catMakanan = await prisma.category.upsert({
    where: { slug: 'makanan' },
    update: { name: 'Makanan', sortOrder: 3 },
    create: { name: 'Makanan', slug: 'makanan', sortOrder: 3 },
  })
  console.log('[Categories] 3 Real Categories (Kopi, Non-Kopi, Makanan) ensured.')

  // 4. Tags (Mood, Flavor, Format)
  const tagsData: Array<{ slug: string; name: string; dimension: TagDimension }> = [
    // Mood
    { slug: 'santai', name: 'Santai', dimension: TagDimension.MOOD },
    { slug: 'fokus', name: 'Fokus', dimension: TagDimension.MOOD },
    { slug: 'segar', name: 'Segar', dimension: TagDimension.MOOD },
    // Flavor
    { slug: 'manis', name: 'Manis', dimension: TagDimension.FLAVOR },
    { slug: 'pahit_bold', name: 'Pahit & Bold', dimension: TagDimension.FLAVOR },
    { slug: 'asam_segar', name: 'Asam Segar', dimension: TagDimension.FLAVOR },
    { slug: 'creamy', name: 'Creamy Gurih', dimension: TagDimension.FLAVOR },
    // Format
    { slug: 'dingin', name: 'Dingin & Segar', dimension: TagDimension.FORMAT },
    { slug: 'panas', name: 'Hangat Menenangkan', dimension: TagDimension.FORMAT },
    { slug: 'cemilan', name: 'Cemilan Pastry', dimension: TagDimension.FORMAT },
  ]

  const tagMap = new Map<string, string>()
  for (const t of tagsData) {
    const createdTag = await prisma.tag.upsert({
      where: { slug: t.slug },
      update: { name: t.name, dimension: t.dimension },
      create: { slug: t.slug, name: t.name, dimension: t.dimension },
    })
    tagMap.set(t.slug, createdTag.id)
  }
  console.log(`[Tags] ${tagsData.length} Tags initialized across 3 dimensions.`)

  // 5. Quiz Questions, Options & Tag Mappings (Weights: Flavor=3, Format=2, Mood=1)
  // Step 1: Mood
  const qMood = await prisma.quizQuestion.upsert({
    where: { stepNumber: 1 },
    update: {
      title: 'Bagaimana suasana atau mood Anda saat ini?',
      description: 'Pilih suasana yang paling menggambarkan kondisi atau rencana Anda di kafe.',
      dimension: TagDimension.MOOD,
    },
    create: {
      stepNumber: 1,
      title: 'Bagaimana suasana atau mood Anda saat ini?',
      description: 'Pilih suasana yang paling menggambarkan kondisi atau rencana Anda di kafe.',
      dimension: TagDimension.MOOD,
    },
  })

  const moodOptions = [
    { label: 'Santai', desc: 'Ngobrol riang, bersantai, melepas penat', icon: '☕', tag: 'santai', sort: 1 },
    { label: 'Fokus', desc: 'Bekerja, membaca, atau butuh konsentrasi tinggi', icon: '💻', tag: 'fokus', sort: 2 },
    { label: 'Segar', desc: 'Mencari suntikan kesegaran dan pelepas dahaga', icon: '⚡', tag: 'segar', sort: 3 },
  ]

  for (const opt of moodOptions) {
    const qOpt = await prisma.quizOption.upsert({
      where: { id: `quiz-opt-mood-${opt.tag}` },
      update: { questionId: qMood.id, label: opt.label, description: opt.desc, icon: opt.icon, sortOrder: opt.sort },
      create: { id: `quiz-opt-mood-${opt.tag}`, questionId: qMood.id, label: opt.label, description: opt.desc, icon: opt.icon, sortOrder: opt.sort },
    })
    const tagId = tagMap.get(opt.tag)
    if (tagId) {
      await prisma.quizOptionTag.upsert({
        where: { optionId_tagId: { optionId: qOpt.id, tagId } },
        update: { weight: 1 },
        create: { optionId: qOpt.id, tagId, weight: 1 },
      })
    }
  }

  // Step 2: Flavor
  const qFlavor = await prisma.quizQuestion.upsert({
    where: { stepNumber: 2 },
    update: {
      title: 'Karakter rasa apa yang sedang Anda idamkan?',
      description: 'Pilih sentuhan rasa utama yang paling menggugah selera Anda.',
      dimension: TagDimension.FLAVOR,
    },
    create: {
      stepNumber: 2,
      title: 'Karakter rasa apa yang sedang Anda idamkan?',
      description: 'Pilih sentuhan rasa utama yang paling menggugah selera Anda.',
      dimension: TagDimension.FLAVOR,
    },
  })

  const flavorOptions = [
    { label: 'Manis Lembut', desc: 'Sentuhan manis nikmat yang memanjakan lidah', icon: '🍯', tag: 'manis', sort: 1 },
    { label: 'Pahit & Bold', desc: 'Intensitas kopi mantap dan tegas tanpa kompromi', icon: '🖤', tag: 'pahit_bold', sort: 2 },
    { label: 'Asam Segar', desc: 'Sensasi buah asam alami yang membangkitkan indra', icon: '🍋', tag: 'asam_segar', sort: 3 },
    { label: 'Creamy Gurih', desc: 'Tekstur susu lembut dan gurih yang menenangkan', icon: '🥛', tag: 'creamy', sort: 4 },
  ]

  for (const opt of flavorOptions) {
    const qOpt = await prisma.quizOption.upsert({
      where: { id: `quiz-opt-flavor-${opt.tag}` },
      update: { questionId: qFlavor.id, label: opt.label, description: opt.desc, icon: opt.icon, sortOrder: opt.sort },
      create: { id: `quiz-opt-flavor-${opt.tag}`, questionId: qFlavor.id, label: opt.label, description: opt.desc, icon: opt.icon, sortOrder: opt.sort },
    })
    const tagId = tagMap.get(opt.tag)
    if (tagId) {
      await prisma.quizOptionTag.upsert({
        where: { optionId_tagId: { optionId: qOpt.id, tagId } },
        update: { weight: 3 }, // Flavor weight = 3
        create: { optionId: qOpt.id, tagId, weight: 3 },
      })
    }
  }

  // Step 3: Format
  const qFormat = await prisma.quizQuestion.upsert({
    where: { stepNumber: 3 },
    update: {
      title: 'Format penyajian mana yang Anda inginkan?',
      description: 'Pilih suhu sajian atau teman ngemil yang pas untuk saat ini.',
      dimension: TagDimension.FORMAT,
    },
    create: {
      stepNumber: 3,
      title: 'Format penyajian mana yang Anda inginkan?',
      description: 'Pilih suhu sajian atau teman ngemil yang pas untuk saat ini.',
      dimension: TagDimension.FORMAT,
    },
  })

  const formatOptions = [
    { label: 'Dingin & Es', desc: 'Sajian dingin dengan kesegaran es optimal', icon: '🧊', tag: 'dingin', sort: 1 },
    { label: 'Hangat / Panas', desc: 'Sajian hangat yang menenangkan tubuh', icon: '♨️', tag: 'panas', sort: 2 },
    { label: 'Cemilan Pastry', desc: 'Pastry renyah atau kudapan lezat peneman minum', icon: '🥐', tag: 'cemilan', sort: 3 },
  ]

  for (const opt of formatOptions) {
    const qOpt = await prisma.quizOption.upsert({
      where: { id: `quiz-opt-format-${opt.tag}` },
      update: { questionId: qFormat.id, label: opt.label, description: opt.desc, icon: opt.icon, sortOrder: opt.sort },
      create: { id: `quiz-opt-format-${opt.tag}`, questionId: qFormat.id, label: opt.label, description: opt.desc, icon: opt.icon, sortOrder: opt.sort },
    })
    const tagId = tagMap.get(opt.tag)
    if (tagId) {
      await prisma.quizOptionTag.upsert({
        where: { optionId_tagId: { optionId: qOpt.id, tagId } },
        update: { weight: 2 }, // Format weight = 2
        create: { optionId: qOpt.id, tagId, weight: 2 },
      })
    }
  }
  console.log('[Quiz] 3-Step Quiz Questions & Weighted Tag Options initialized.')

  // 6. Modifier Groups & Options
  // Tingkat Kemanisan
  const modSweetness = await prisma.modifierGroup.upsert({
    where: { id: 'mod-group-sweetness' },
    update: { name: 'Tingkat Kemanisan', isRequired: true, minSelect: 1, maxSelect: 1 },
    create: { id: 'mod-group-sweetness', name: 'Tingkat Kemanisan', isRequired: true, minSelect: 1, maxSelect: 1 },
  })

  const sweetOptions = [
    { id: 'opt-sweet-100', name: 'Normal Sweet (100%)', price: 0 },
    { id: 'opt-sweet-70', name: 'Less Sweet (70%)', price: 0 },
    { id: 'opt-sweet-30', name: 'Slightly Sweet (30%)', price: 0 },
    { id: 'opt-sweet-0', name: 'No Sugar (0%)', price: 0 },
  ]
  for (const o of sweetOptions) {
    await prisma.modifierOption.upsert({
      where: { id: o.id },
      update: { groupId: modSweetness.id, name: o.name, price: o.price, isAvailable: true },
      create: { id: o.id, groupId: modSweetness.id, name: o.name, price: o.price, isAvailable: true },
    })
  }

  // Pilihan Es
  const modIce = await prisma.modifierGroup.upsert({
    where: { id: 'mod-group-ice' },
    update: { name: 'Pilihan Es', isRequired: true, minSelect: 1, maxSelect: 1 },
    create: { id: 'mod-group-ice', name: 'Pilihan Es', isRequired: true, minSelect: 1, maxSelect: 1 },
  })

  const iceOptions = [
    { id: 'opt-ice-normal', name: 'Normal Ice', price: 0 },
    { id: 'opt-ice-less', name: 'Less Ice', price: 0 },
    { id: 'opt-ice-none', name: 'No Ice', price: 0 },
  ]
  for (const o of iceOptions) {
    await prisma.modifierOption.upsert({
      where: { id: o.id },
      update: { groupId: modIce.id, name: o.name, price: o.price, isAvailable: true },
      create: { id: o.id, groupId: modIce.id, name: o.name, price: o.price, isAvailable: true },
    })
  }

  // Pilihan Susu
  const modMilk = await prisma.modifierGroup.upsert({
    where: { id: 'mod-group-milk' },
    update: { name: 'Pilihan Susu', isRequired: false, minSelect: 0, maxSelect: 1 },
    create: { id: 'mod-group-milk', name: 'Pilihan Susu', isRequired: false, minSelect: 0, maxSelect: 1 },
  })

  const milkOptions = [
    { id: 'opt-milk-fresh', name: 'Fresh Milk', price: 0 },
    { id: 'opt-milk-oat', name: 'Oat Milk (Plant-based)', price: 8000 },
    { id: 'opt-milk-almond', name: 'Almond Milk', price: 8000 },
  ]
  for (const o of milkOptions) {
    await prisma.modifierOption.upsert({
      where: { id: o.id },
      update: { groupId: modMilk.id, name: o.name, price: o.price, isAvailable: true },
      create: { id: o.id, groupId: modMilk.id, name: o.name, price: o.price, isAvailable: true },
    })
  }

  // Extra Shot
  const modAddon = await prisma.modifierGroup.upsert({
    where: { id: 'mod-group-addon' },
    update: { name: 'Tambahan / Add-on', isRequired: false, minSelect: 0, maxSelect: 2 },
    create: { id: 'mod-group-addon', name: 'Tambahan / Add-on', isRequired: false, minSelect: 0, maxSelect: 2 },
  })

  await prisma.modifierOption.upsert({
    where: { id: 'opt-extra-shot' },
    update: { groupId: modAddon.id, name: 'Extra Shot Espresso', price: 6000, isAvailable: true },
    create: { id: 'opt-extra-shot', groupId: modAddon.id, name: 'Extra Shot Espresso', price: 6000, isAvailable: true },
  })
  console.log('[Modifiers] Modifier Groups & Options initialized.')

  // 7. 18 Menu Items (6 Kopi, 6 Non-Kopi, 6 Makanan)
  interface MenuItemSeed {
    id: string
    name: string
    description: string
    price: number
    categoryId: string
    isPopular: boolean
    soldCount: number
    tagSlugs: string[]
    modGroupIds: string[]
  }

  const menuSeedList: MenuItemSeed[] = [
    // --- KOPI (6 Menu) ---
    {
      id: 'menu-kopi-sela',
      name: 'Es Kopi Susu Sela',
      description: 'Espresso house blend dengan susu segar dan gula aren organik khas SELA.',
      price: 28000,
      categoryId: catKopi.id,
      isPopular: true,
      soldCount: 185,
      tagSlugs: ['santai', 'creamy', 'dingin'],
      modGroupIds: [modSweetness.id, modIce.id, modMilk.id, modAddon.id],
    },
    {
      id: 'menu-americano',
      name: 'Americano Robusta/Arabica',
      description: 'Double shot espresso murni dengan air mineral berkualitas.',
      price: 24000,
      categoryId: catKopi.id,
      isPopular: false,
      soldCount: 92,
      tagSlugs: ['fokus', 'pahit_bold', 'dingin'],
      modGroupIds: [modIce.id, modAddon.id],
    },
    {
      id: 'menu-vanilla-latte',
      name: 'Vanilla Latte Artisan',
      description: 'Espresso lembut berpadu dengan sirup vanilla Madagaskar dan microfoam halus.',
      price: 32000,
      categoryId: catKopi.id,
      isPopular: false,
      soldCount: 78,
      tagSlugs: ['santai', 'manis', 'dingin'],
      modGroupIds: [modSweetness.id, modIce.id, modMilk.id],
    },
    {
      id: 'menu-caramel-macchiato',
      name: 'Caramel Macchiato Sela',
      description: 'Layering espresso pekat, sirup vanila lembut, dan lelehan saus karamel legit.',
      price: 34000,
      categoryId: catKopi.id,
      isPopular: false,
      soldCount: 65,
      tagSlugs: ['santai', 'manis', 'dingin'],
      modGroupIds: [modSweetness.id, modIce.id, modMilk.id],
    },
    {
      id: 'menu-cold-brew',
      name: 'Cold Brew Reserve',
      description: 'Diseduh perlahan selama 16 jam, menghasilkan cita rasa kopi halus tanpa rasa asam menusuk.',
      price: 30000,
      categoryId: catKopi.id,
      isPopular: false,
      soldCount: 54,
      tagSlugs: ['fokus', 'pahit_bold', 'dingin'],
      modGroupIds: [modIce.id],
    },
    {
      id: 'menu-flat-white',
      name: 'Flat White Australian',
      description: 'Rasio double shot espresso kuat dengan microfoam velvety hangat.',
      price: 28000,
      categoryId: catKopi.id,
      isPopular: false,
      soldCount: 42,
      tagSlugs: ['fokus', 'creamy', 'panas'],
      modGroupIds: [modMilk.id, modAddon.id],
    },

    // --- NON-KOPI (6 Menu) ---
    {
      id: 'menu-matcha-latte',
      name: 'Kyoto Matcha Latte',
      description: 'Matcha Uji ceremonial grade berpadu dengan susu segar lembut dan madu.',
      price: 32000,
      categoryId: catNonKopi.id,
      isPopular: true,
      soldCount: 140,
      tagSlugs: ['santai', 'manis', 'dingin'],
      modGroupIds: [modSweetness.id, modIce.id, modMilk.id],
    },
    {
      id: 'menu-earl-grey-tea',
      name: 'Artisan Earl Grey Milk Tea',
      description: 'Seduhan daun teh hitam bergamot aromatik dengan sentuhan susu kental manis.',
      price: 28000,
      categoryId: catNonKopi.id,
      isPopular: false,
      soldCount: 60,
      tagSlugs: ['santai', 'creamy', 'dingin'],
      modGroupIds: [modSweetness.id, modIce.id],
    },
    {
      id: 'menu-dark-chocolate',
      name: 'Dark Velvet Chocolate',
      description: 'Kakao murni Jawa Barat 70% dengan susu hangat nikmat dan taburan marshmallow.',
      price: 30000,
      categoryId: catNonKopi.id,
      isPopular: false,
      soldCount: 88,
      tagSlugs: ['santai', 'manis', 'panas'],
      modGroupIds: [modSweetness.id, modMilk.id],
    },
    {
      id: 'menu-strawberry-hibiscus',
      name: 'Strawberry Hibiscus Cooler',
      description: 'Infusi bunga rosella segar dengan sirup stroberi alami dan soda dingin.',
      price: 28000,
      categoryId: catNonKopi.id,
      isPopular: false,
      soldCount: 71,
      tagSlugs: ['segar', 'asam_segar', 'dingin'],
      modGroupIds: [modSweetness.id, modIce.id],
    },
    {
      id: 'menu-taro-latte',
      name: 'Taro Blossom Latte',
      description: 'Rasa talas ungu manis gurih dengan tekstur creamy dan aroma bunga kelopak.',
      price: 30000,
      categoryId: catNonKopi.id,
      isPopular: false,
      soldCount: 49,
      tagSlugs: ['santai', 'manis', 'dingin'],
      modGroupIds: [modSweetness.id, modIce.id],
    },
    {
      id: 'menu-chamomile-honey',
      name: 'Honey Chamomile Relax',
      description: 'Seduhan bunga kamomil bebas kafein dengan madu hutan murni yang meredakan stres.',
      price: 26000,
      categoryId: catNonKopi.id,
      isPopular: false,
      soldCount: 35,
      tagSlugs: ['santai', 'manis', 'panas'],
      modGroupIds: [],
    },

    // --- MAKANAN & BAKES (6 Menu) ---
    {
      id: 'menu-croissant',
      name: 'French Butter Croissant',
      description: 'Pastry renyah berlapis dengan aroma mentega Prancis autentik dan tekstur lembut.',
      price: 26000,
      categoryId: catMakanan.id,
      isPopular: true,
      soldCount: 165,
      tagSlugs: ['santai', 'manis', 'cemilan'],
      modGroupIds: [],
    },
    {
      id: 'menu-pain-au-chocolat',
      name: 'Pain Au Chocolat',
      description: 'Pastry klasik Prancis dengan isian double dark chocolate batons berkualitas.',
      price: 29000,
      categoryId: catMakanan.id,
      isPopular: false,
      soldCount: 84,
      tagSlugs: ['santai', 'manis', 'cemilan'],
      modGroupIds: [],
    },
    {
      id: 'menu-cinnamon-roll',
      name: 'Cinnamon Roll Sela Glaze',
      description: 'Roti gulung kayu manis aromatik diselimuti cream cheese glaze gurih manis.',
      price: 28000,
      categoryId: catMakanan.id,
      isPopular: false,
      soldCount: 96,
      tagSlugs: ['santai', 'manis', 'cemilan'],
      modGroupIds: [],
    },
    {
      id: 'menu-almond-danish',
      name: 'Almond Danish Pastry',
      description: 'Flaky pastry dengan pasta almond manis dan taburan kacang almond panggang renyah.',
      price: 32000,
      categoryId: catMakanan.id,
      isPopular: false,
      soldCount: 52,
      tagSlugs: ['santai', 'manis', 'cemilan'],
      modGroupIds: [],
    },
    {
      id: 'menu-truffle-fries',
      name: 'Truffle Parmesan Fries',
      description: 'Kentang goreng renyah disiram minyak truffle aromatik dan taburan keju parmesan gurih.',
      price: 35000,
      categoryId: catMakanan.id,
      isPopular: false,
      soldCount: 110,
      tagSlugs: ['santai', 'pahit_bold', 'cemilan'],
      modGroupIds: [],
    },
    {
      id: 'menu-beef-quiche',
      name: 'Smoked Beef & Cheese Quiche',
      description: 'Pai panggang isi daging asap, keju cheddar leleh, dan custard telur yang kaya rasa.',
      price: 36000,
      categoryId: catMakanan.id,
      isPopular: false,
      soldCount: 63,
      tagSlugs: ['fokus', 'creamy', 'cemilan'],
      modGroupIds: [],
    },
  ]

  for (const item of menuSeedList) {
    const createdItem = await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        description: item.description,
        price: item.price,
        categoryId: item.categoryId,
        isPopular: item.isPopular,
        soldCount: item.soldCount,
        isAvailable: true,
        isArchived: false,
        deletedAt: null,
      },
      create: {
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        categoryId: item.categoryId,
        isPopular: item.isPopular,
        soldCount: item.soldCount,
        isAvailable: true,
        isArchived: false,
      },
    })

    // Connect Tags
    for (const slug of item.tagSlugs) {
      const tagId = tagMap.get(slug)
      if (tagId) {
        await prisma.menuItemTag.upsert({
          where: { menuItemId_tagId: { menuItemId: createdItem.id, tagId } },
          update: {},
          create: { menuItemId: createdItem.id, tagId },
        })
      }
    }

    // Connect Modifier Groups
    for (const groupId of item.modGroupIds) {
      await prisma.menuItemModifierGroup.upsert({
        where: { menuItemId_groupId: { menuItemId: createdItem.id, groupId } },
        update: {},
        create: { menuItemId: createdItem.id, groupId },
      })
    }
  }
  console.log(`[MenuItems] ${menuSeedList.length} Menu Items seeded with tags and modifier groups.`)

  // 8. Staff Users (Dev Credentials - Clearly Documented as Non-Production)
  // Dev-only testing credentials:
  // admin   -> password: "adminpassword123"
  // kasir   -> PIN: "1234"
  // barista -> PIN: "5678"
  const devAdminPasswordHash = bcrypt.hashSync('adminpassword123', 10)
  const devKasirPinHash = bcrypt.hashSync('1234', 10)
  const devBaristaPinHash = bcrypt.hashSync('5678', 10)

  await prisma.staffUser.upsert({
    where: { username: 'admin' },
    update: {
      displayName: 'Administrator SELA',
      role: 'ADMIN',
      passwordHash: devAdminPasswordHash,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      username: 'admin',
      displayName: 'Administrator SELA',
      role: 'ADMIN',
      passwordHash: devAdminPasswordHash,
      isActive: true,
      failedLoginAttempts: 0,
    },
  })

  await prisma.staffUser.upsert({
    where: { username: 'kasir' },
    update: {
      displayName: 'Kasir Front Office',
      role: 'CASHIER',
      pinHash: devKasirPinHash,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      username: 'kasir',
      displayName: 'Kasir Front Office',
      role: 'CASHIER',
      pinHash: devKasirPinHash,
      isActive: true,
      failedLoginAttempts: 0,
    },
  })

  await prisma.staffUser.upsert({
    where: { username: 'barista' },
    update: {
      displayName: 'Barista Kitchen',
      role: 'BARISTA',
      pinHash: devBaristaPinHash,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      username: 'barista',
      displayName: 'Barista Kitchen',
      role: 'BARISTA',
      pinHash: devBaristaPinHash,
      isActive: true,
      failedLoginAttempts: 0,
    },
  })
  console.log('[StaffUsers] 3 Staff roles (Admin, Kasir, Barista) seeded with valid bcrypt hashes for local testing.')

  console.log('--- Idempotent Seeding Completed Successfully! ---')
}

main()
  .catch((e) => {
    console.error('Seeding encountered an error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
