const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixRowOrder() {
  console.log('Starting row order fix...');
  
  try {
    // Get all products that don't have __original_row_number__ in raw_data
    const products = await prisma.product.findMany({
      where: {
        raw_data: {
          not: null
        }
      },
      orderBy: [
        { upload_id: 'asc' },
        { created_at: 'asc' }
      ]
    });

    console.log(`Found ${products.length} products to process`);

    let processed = 0;
    let currentUploadId = null;
    let rowCounter = 2; // Start from row 2 (skip header row)

    for (const product of products) {
      // Reset counter for new upload
      if (currentUploadId !== product.upload_id) {
        currentUploadId = product.upload_id;
        rowCounter = 2;
        console.log(`Processing upload ${currentUploadId}`);
      }

      try {
        const rawData = JSON.parse(product.raw_data);
        
        // Only add row number if it doesn't exist
        if (!rawData.__original_row_number__) {
          rawData.__original_row_number__ = rowCounter;
          
          await prisma.product.update({
            where: { id: product.id },
            data: {
              raw_data: JSON.stringify(rawData)
            }
          });
          
          processed++;
        }
        
        rowCounter++;
      } catch (error) {
        console.warn(`Failed to process product ${product.id}:`, error);
      }
    }

    console.log(`Fixed row order for ${processed} products`);
    
    // Also fix UI items by adding a row number based on creation order
    const uiItems = await prisma.uIItem.findMany({
      orderBy: [
        { upload_id: 'asc' },
        { created_at: 'asc' }
      ]
    });

    console.log(`Found ${uiItems.length} UI items to process`);

    let uiProcessed = 0;
    currentUploadId = null;
    rowCounter = 2;

    for (const uiItem of uiItems) {
      // Reset counter for new upload
      if (currentUploadId !== uiItem.upload_id) {
        currentUploadId = uiItem.upload_id;
        rowCounter = 2;
        console.log(`Processing UI items for upload ${currentUploadId}`);
      }

      try {
        const values = JSON.parse(uiItem.values);
        
        // Add row number to values
        if (!values.__original_row_number__) {
          values.__original_row_number__ = rowCounter;
          
          await prisma.uIItem.update({
            where: { id: uiItem.id },
            data: {
              values: JSON.stringify(values)
            }
          });
          
          uiProcessed++;
        }
        
        rowCounter++;
      } catch (error) {
        console.warn(`Failed to process UI item ${uiItem.id}:`, error);
      }
    }

    console.log(`Fixed row order for ${uiProcessed} UI items`);
    console.log('Row order fix completed!');
    
  } catch (error) {
    console.error('Error fixing row order:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixRowOrder();
