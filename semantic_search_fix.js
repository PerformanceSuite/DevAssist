// Fixed semantic search function for LanceDB v0.21.3
export async function semanticSearch(query, options = {}) {
  const {
    table = 'decisions',
    project = null,
    limit = 10,
    threshold = 0.7
  } = options;
  
  const vectorDb = await getVectorDB();
  const queryEmbedding = await generateEmbedding(query);
  
  // Open the table
  const targetTable = await vectorDb.openTable(table);
  
  try {
    // Execute the search query
    const searchQuery = targetTable.search(queryEmbedding).limit(limit);
    const iterator = await searchQuery.execute();
    
    // Collect results from RecordBatchIterator
    const results = [];
    while (true) {
      const { value, done } = await iterator.next();
      if (done) break;
      
      // value is a RecordBatch which is iterable
      if (value) {
        for (const record of value) {
          results.push(record);
        }
      }
    }
    
    // Filter by project and similarity threshold
    return results.filter(r => {
      const similarityOk = !r._distance || r._distance <= (1 - threshold);
      const projectOk = !project || r.project === project;
      return similarityOk && projectOk;
    });
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}