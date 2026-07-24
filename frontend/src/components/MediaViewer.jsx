import { createContext, useContext, useState, useCallback } from 'react'

const Ctx = createContext(null)
export const useMediaViewer = () => useContext(Ctx)

export function MediaViewerProvider({ children }) {
  const [media, setMedia] = useState(null) // { url, type }

  const open = useCallback((url, type = 'image') => {
    if (url) setMedia({ url, type })
  }, [])

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {media && (
        <div className="mv-backdrop" onClick={() => setMedia(null)}>
          <button className="mv-close" onClick={() => setMedia(null)}>✕</button>
          {media.type === 'video'
            ? <video src={media.url} controls autoPlay className="mv-media" onClick={(e) => e.stopPropagation()} />
            : <img src={media.url} alt="" className="mv-media" onClick={(e) => e.stopPropagation()} />}
        </div>
      )}
    </Ctx.Provider>
  )
}
