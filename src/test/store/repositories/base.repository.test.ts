import { describe, it, expect, vi, beforeEach } from "vitest";
import { BaseRepository } from "../../../store/repositories/base.repository";
import { StorageAdapter } from "../../../store/repositories/adapters/types";
import { EntityBase } from "../../../store/repository";

interface MockEntity extends EntityBase {
  name: string;
}

class TestRepository extends BaseRepository<MockEntity> {
  constructor(adapter: StorageAdapter) {
    super(adapter, "test-collection");
  }
}

describe("BaseRepository", () => {
  let adapter: StorageAdapter;
  let repository: TestRepository;

  beforeEach(() => {
    adapter = {
      count: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    repository = new TestRepository(adapter);
  });

  it("should count items", async () => {
    vi.mocked(adapter.count).mockResolvedValue(5);
    const count = await repository.count();
    expect(count).toBe(5);
    expect(adapter.count).toHaveBeenCalledWith("test-collection");
  });

  it("should get one item", async () => {
    const mockItem: MockEntity = { id: "1", name: "Test", type: "mock", createdAt: new Date(), updatedAt: new Date() };
    vi.mocked(adapter.get).mockResolvedValue(mockItem);
    const item = await repository.getOne("1");
    expect(item).toEqual(mockItem);
    expect(adapter.get).toHaveBeenCalledWith("test-collection", "1");
  });

  it("should return null if item not found", async () => {
    vi.mocked(adapter.get).mockResolvedValue(null);
    const item = await repository.getOne("1");
    expect(item).toBeNull();
  });

  it("should get all items", async () => {
    const mockItems: MockEntity[] = [{ id: "1", name: "Test", type: "mock", createdAt: new Date(), updatedAt: new Date() }];
    vi.mocked(adapter.getAll).mockResolvedValue(mockItems);
    const items = await repository.getAll();
    expect(items).toEqual(mockItems);
    expect(adapter.getAll).toHaveBeenCalledWith("test-collection", undefined);
  });

  it("should save an item", async () => {
    const mockItem: MockEntity = { id: "1", name: "Test", type: "mock", createdAt: new Date(), updatedAt: new Date() };
    vi.mocked(adapter.save).mockResolvedValue(mockItem);
    const item = await repository.save(mockItem);
    expect(item).toEqual(mockItem);
    expect(adapter.save).toHaveBeenCalledWith("test-collection", mockItem);
  });

  it("should update an existing item", async () => {
    const mockItem: MockEntity = { id: "1", name: "Updated", type: "mock", createdAt: new Date(), updatedAt: new Date() };
    vi.mocked(adapter.get).mockResolvedValue(mockItem);
    vi.mocked(adapter.save).mockResolvedValue(mockItem);
    
    const item = await repository.update("1", mockItem);
    expect(item).toEqual(mockItem);
    expect(adapter.save).toHaveBeenCalledWith("test-collection", { ...mockItem, id: "1" });
  });

  it("should throw error when updating non-existent item", async () => {
    vi.mocked(adapter.get).mockResolvedValue(null);
    await expect(repository.update("1", {} as any)).rejects.toThrow("test-collection with id 1 not found");
  });

  it("should delete an item", async () => {
    vi.mocked(adapter.delete).mockResolvedValue(true);
    const result = await repository.delete("1");
    expect(result).toBe(true);
    expect(adapter.delete).toHaveBeenCalledWith("test-collection", "1");
  });
});
