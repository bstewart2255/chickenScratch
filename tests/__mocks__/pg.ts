export const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

export const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
  query: jest.fn(),
  end: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

export const Pool = jest.fn(() => mockPool);