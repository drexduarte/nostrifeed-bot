let data = { links: [] };

module.exports = {
  __setMockData(mockData) {
    data = mockData;
  },
  __getMockData() {
    return data;
  },
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => JSON.stringify(data)),
  writeFileSync: jest.fn((_, content) => {
    data = JSON.parse(content);
  })
};