import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { username, url } = await req.json()

    if (!username) {
      throw new Error('Username is required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_API')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables (URL or Service Role Key)')
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    // Generate AI analysis using Gemini
    let analyzedVideos = []
    let detectedCategory = 'General'
    
    if (geminiKey) {
      try {
        const prompt = `Analyze the potential engagement metrics for an Instagram profile named "${username}". 
        The profile URL is "${url || `https://www.instagram.com/${username}/`}".
        1. Determine the most likely category for this profile (e.g., Fitness, Tech, Fashion, Travel, Food, Sports).
        2. Provide data for 5 potential top-performing videos.
        Include for each video: views, likes, comments, and shares.
        
        Format the response as a JSON object with keys:
        "category": "Detected Category Name",
        "videos": [
          { "views": 1000, "likes": 100, "comments": 10, "shares": 5 },
          ...
        ]`

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { response_mime_type: "application/json" }
          })
        })

        const result = await response.json()
        if (result.error) throw new Error(result.error.message)
        
        let aiText = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
        // Handle potential markdown formatting
        const jsonMatch = aiText.match(/\{[\s\S]*\}/)
        if (jsonMatch) aiText = jsonMatch[0]
        
        const parsed = JSON.parse(aiText)
        if (parsed.category) detectedCategory = parsed.category
        if (Array.isArray(parsed.videos)) {
          analyzedVideos = parsed.videos
        }
      } catch (aiError) {
        console.error('Gemini Analysis Error:', aiError)
        // Fallback to simulation if AI fails
      }
    }

    // Fallback/Simulation if AI didn't provide results
    if (analyzedVideos.length === 0) {
      const videoCount = 5
      for (let i = 0; i < videoCount; i++) {
        const views = Math.floor(Math.random() * 800000) + 50000
        const likes = Math.floor(views * (Math.random() * 0.12 + 0.03))
        const comments = Math.floor(likes * (Math.random() * 0.06 + 0.015))
        const shares = Math.floor(likes * (Math.random() * 0.1 + 0.01))
        analyzedVideos.push({ views, likes, comments, shares })
      }
    }

    // Add score and IDs to results
    const results = analyzedVideos.map((v, i) => {
      const score = ((v.likes || 0) * 4) + ((v.shares || 0) * 6) + ((v.comments || 0) * 5) + ((v.views || 0) * 0.15)
      return {
        ...v,
        id: i,
        score,
        thumbnail: `Video #${i + 1}`
      }
    }).sort((a, b) => b.score - a.score)

    const topVideo = results[0]

    // Store in database
    const { error: dbError } = await supabaseClient
      .from('instagram_profile_data')
      .insert([{
        category: detectedCategory,
        instagram_profile_id: username,
        instagram_link: url || `https://www.instagram.com/${username}/`,
        views: topVideo.views,
        likes: topVideo.likes,
        shares: topVideo.shares,
        comments: topVideo.comments
      }])

    if (dbError) {
      console.error('Database Error:', dbError)
      throw new Error(`Database Error: ${dbError.message}`)
    }

    return new Response(
      JSON.stringify({ 
        profileId: username,
        category: detectedCategory,
        videos: results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
