import { describe, it, expect, beforeEach, vi } from 'vitest'
import { cachedList } from './cache.js'

beforeEach(() => {
  localStorage.clear()
})

describe('cachedList', () => {
  it('ходит за данными один раз, а дальше отдаёт кэш', async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: '1' }])
    const cache = cachedList('test', 1000, fetcher)

    await cache.read()
    await cache.read()

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('схлопывает параллельные вызовы в один запрос', async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: '1' }])
    const cache = cachedList('test', 1000, fetcher)

    await Promise.all([cache.read(), cache.read(), cache.read()])

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('переживает перезагрузку страницы через localStorage', async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: '1' }])
    await cachedList('test', 1000, fetcher).read()

    // Новый экземпляр = новая загрузка страницы: память пуста, localStorage — нет
    const afterReload = vi.fn().mockResolvedValue([{ id: 'свежее' }])
    const data = await cachedList('test', 1000, afterReload).read()

    expect(afterReload).not.toHaveBeenCalled()
    expect(data).toEqual([{ id: '1' }])
  })

  it('перезапрашивает данные, когда localStorage-копия протухла', async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: '1' }])
    await cachedList('test', 1000, fetcher).read()

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000)
    const afterTtl = vi.fn().mockResolvedValue([{ id: 'свежее' }])
    const data = await cachedList('test', 1000, afterTtl).read()

    expect(afterTtl).toHaveBeenCalledTimes(1)
    expect(data).toEqual([{ id: 'свежее' }])
    vi.restoreAllMocks()
  })

  it('после invalidate идёт в сеть заново', async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: '1' }])
    const cache = cachedList('test', 1000, fetcher)

    await cache.read()
    cache.invalidate()
    await cache.read()

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem('askesis:cache:test')).not.toBeNull()
  })

  it('не запоминает неудачный запрос — иначе одна потеря сети залипла бы навсегда', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('нет сети'))
      .mockResolvedValue([{ id: '1' }])
    const cache = cachedList('test', 1000, fetcher)

    await expect(cache.read()).rejects.toThrow('нет сети')
    await expect(cache.read()).resolves.toEqual([{ id: '1' }])
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('отдаёт копию массива: сортировка на одном экране не портит кэш для других', async () => {
    const cache = cachedList('test', 1000, vi.fn().mockResolvedValue([{ id: 'b' }, { id: 'a' }]))

    const first = await cache.read()
    first.reverse()
    const second = await cache.read()

    expect(second).toEqual([{ id: 'b' }, { id: 'a' }])
  })

  it('работает через сеть, когда localStorage недоступен (приватный режим)', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const fetcher = vi.fn().mockResolvedValue([{ id: '1' }])

    await expect(cachedList('test', 1000, fetcher).read()).resolves.toEqual([{ id: '1' }])
    vi.restoreAllMocks()
  })

  it('игнорирует запись, оставшуюся от прежней версии формата', async () => {
    localStorage.setItem(
      'askesis:cache:test',
      JSON.stringify({ version: 0, savedAt: Date.now(), data: [{ id: 'старое' }] }),
    )
    const fetcher = vi.fn().mockResolvedValue([{ id: 'новое' }])

    await expect(cachedList('test', 1000, fetcher).read()).resolves.toEqual([{ id: 'новое' }])
  })

  it('не спотыкается о битый JSON в localStorage', async () => {
    localStorage.setItem('askesis:cache:test', 'не json')
    const fetcher = vi.fn().mockResolvedValue([{ id: '1' }])

    await expect(cachedList('test', 1000, fetcher).read()).resolves.toEqual([{ id: '1' }])
  })
})
