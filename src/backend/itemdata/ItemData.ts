import { prisma } from './../backend';


async function requestSkyblockItemsEndpoint() {
  const url = `https://api.hypixel.net/v2/resources/skyblock/items`
  try {
    const response = await (await fetch(url)).text()
    return response
  } catch(exception) {
    console.error(exception)
    return "{}"
  }
}

export async function getSkyblockItemEndpointResponse(): Promise<{ success: boolean; data: string }> {

  const data: {
    products: {
      itemId: string
      rarity: string
      name: string
      npcSell: number
      bazaarBuy: number
      bazaarSell: number
      averageBazaarBuy: number
      averageBazaarSell: number
      lowestBin: number,
      averageLowestBin: number
    }[]
  } = {
    products: []
  }

  const skyblockItem = await prisma.itemData.findMany({
    include: {
      bazaarData: true,
      aucitonData: true
    }
  })

  skyblockItem.forEach((item) => {
    data.products.push({
      itemId: item.itemId,
      rarity: item.rarity,
      name: item.name,
      npcSell: item.npcSellPrice ?? 0,
      bazaarBuy: item.bazaarData?.buyPrice ?? 0,
      bazaarSell: item.bazaarData?.sellPrice ?? 0,
      averageBazaarBuy: item.bazaarData?.averageBuyPrice ?? 0,
      averageBazaarSell: item.bazaarData?.averageSellPrice ?? 0,
      lowestBin: item.aucitonData?.lowestBin ?? 0,
      averageLowestBin: item.aucitonData?.averageLowestBin ?? 0
    })
  })

  return { success: true, data: JSON.stringify(data) }
}


export async function loadItemData() {
  try {

  console.log("Loading item data")
  const requestPromises: Promise<string>[] = [
    requestSkyblockItemsEndpoint()
  ]

  const endpoints = await Promise.all(requestPromises)
  const skyblockItemResponse = JSON.parse(endpoints[0])
  if (skyblockItemResponse?.success != true || skyblockItemResponse?.items == null) {
    console.error("Error getting skyblock items")
    return
  }

  const skyblockItems: any[] = skyblockItemResponse?.items

  prisma.itemData.findMany({
    select: {
      itemId: true
    }
  })
  .then((items) => {
    prisma.$disconnect()
    const itemIds = items.map(obj => obj.itemId)
    const itemsToCreate: {data: {
      itemId: string
      rarity: string
      name: string
      npcSellPrice: number
    }[]
    } = {
      data: []
    }
    const itemsToUpdate: {
      where: {
        itemId: string
      }
      data: {
        npcSellPrice: number
      }
    }[] = []
    skyblockItems.forEach(item => {
      if (!itemIds.includes(item.id)) {
        itemsToCreate.data.push({
          itemId: item.id ?? "",
          rarity: item.tier ?? "",
          name: item.name ?? "",
          npcSellPrice: item.npc_sell_price ?? 0
        })
      } else {
        itemsToUpdate.push({
          where: {
            itemId: item.id
          },
          data: {
            npcSellPrice: item.npc_sell_price
          }
        })
      }
    });
    const updatePromises: Promise<void>[] = []

    itemsToUpdate.forEach(element => {
      updatePromises.push(new Promise<void>((resolve, reject) => {
        prisma.itemData.update(element).then(() => {
          resolve()
        }).catch((reason) => {
          reject(reason)
        })
      }))
    });
  
    prisma.itemData.createMany(itemsToCreate).then(() => {
      Promise.all(updatePromises).then(() => {
        prisma.$disconnect()
      }).catch((error) => {
        console.error(error)
      })
    }).catch((error) => {
      console.error(error)
    })
  }).catch((error) => {
    console.error(error)
  })
}
catch (error) {
  console.error(error)
}
}