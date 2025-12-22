export const MOCK_SCRIPT = 
{
  "title": "Why HTTP is Stateless: The Web's Core Design Principle",
  "description": "Ever wondered why HTTP doesn't remember you between requests? This video explains the fundamental concept of HTTP statelessness, its benefits like scalability and resilience, and how the web still manages to provide a personalized experience despite it. Dive into the core design principle that powers the internet!",
  "tags": [
    "HTTP",
    "Stateless",
    "Web Development",
    "Internet Basics",
    "Networking",
    "Client-Server",
    "Scalability",
    "Cookies",
    "Web Architecture",
    "Tech Explained"
  ],
  "narration": "Hey everyone, and welcome back! Today, we're unraveling a core concept behind how the internet works: Why is HTTP stateless? [PAUSE=1s] HTTP, or the Hypertext Transfer Protocol, is the language your web browser uses to communicate with servers. Every time you click a link, type a URL, or submit a form, an HTTP request is sent from your client to a server, and the server sends back a response. [PAUSE=1s] Now, 'stateless' means that each of these requests is completely independent. The server processes it without any inherent memory or knowledge of previous requests from the same user. [PAUSE=1s] It's like calling a customer service line, where each new call starts fresh, without the agent remembering your last conversation unless you explicitly tell them everything again. So, why was it designed this way, and what are the profound implications for how the web functions today? [PAUSE=8s] To truly grasp statelessness, let's think about a straightforward real-world example: [PAUSE=0.7s] a vending machine. When you walk up to a vending machine, your interaction is simple: you insert your money, press a button corresponding to your desired snack, and receive it. [PAUSE=1s] If you decide you want another snack, you have to repeat the entire process: insert money, press the button again. The machine itself doesn't 'remember' that you just bought something, nor does it keep a running tab or hold onto your change for a future purchase. [PAUSE=1s] Each transaction is a complete, standalone event. This independence, where no past interaction influences the current one, perfectly illustrates the core principle of HTTP's stateless nature. Every request your browser sends to a server is treated with this same 'fresh start' mentality. [PAUSE=8s] So, why adopt such a seemingly forgetful design? The primary, and perhaps most critical, reason is [excited] massive scalability! [PAUSE=1s] Think about websites like Google, Amazon, or Facebook. They handle billions, even trillions, of requests from users around the globe every single day. If each server had to maintain a persistent 'state' for every single active user—remembering their exact location on the site, their shopping cart contents, their last search query—the memory and processing requirements would quickly become astronomical and highly inefficient. [PAUSE=1.5s] With stateless HTTP, any server can handle any request at any time. A sophisticated load balancer can efficiently distribute incoming requests across a vast farm of servers. It doesn't matter which specific server gets your request, because no server holds unique, user-specific information that others don't. This 'share nothing' architecture means adding more servers to handle increased traffic is incredibly straightforward and cost-effective, allowing the web to grow almost infinitely. [PAUSE=8s] Beyond just scalability, statelessness brings significant advantages in terms of simplicity and resilience. [PAUSE=1s] From a server's perspective, the logic becomes far less complex. It doesn't need intricate mechanisms to manage, store, or synchronize user sessions across potentially hundreds or thousands of machines. Each request is processed, a response is sent, and then the server can forget about it, freeing up resources immediately. [PAUSE=1.5s] This simplifies server design and development tremendously. [PAUSE=1s] And for resilience, if a server unexpectedly crashes or goes offline, it's not a catastrophic event for user data. No persistent, user-specific state is lost from that specific machine because it wasn't storing any unique information to begin with. The very next request from the user can simply be routed by the load balancer to any other available server, and everything continues as normal. This makes the web incredibly robust and fault-tolerant, drastically reducing downtime and improving overall reliability. [PAUSE=8s] Okay, so HTTP is stateless. But then, how do websites manage to remember my login status, the items in my shopping cart, or my personalized preferences across different pages and visits? [PAUSE=1s] This is where client-side mechanisms come into play, primarily through small data packets called 'cookies'. When you log into a website, for instance, the server verifies your credentials and then sends a small piece of data—a cookie—back to your browser. Your browser then stores this cookie locally. [PAUSE=1.5s] Crucially, with every subsequent request you make to that same website, your browser automatically includes and sends that stored cookie back to the server. The server can then read this cookie, identify you (often by a unique session ID stored within the cookie), and retrieve your specific state from its own persistent storage, like a database. [PAUSE=1s] So, it's the client reminding the server about your identity and past interactions, rather than the server trying to remember on its own between requests. This clever offloading of responsibility is key. [PAUSE=8s] While cookies are the most prevalent, other methods exist to manage state in a stateless HTTP environment. [PAUSE=0.7s] Server-side sessions are common: a unique session ID is stored in a cookie, but the actual, larger user data is kept on the server's memory or a dedicated session store. This means less data is transmitted with each request, which can be more secure and efficient for complex data. [PAUSE=1s] Another, though less common today, is URL rewriting, where session IDs or even small pieces of data are embedded directly into the URL itself. This works without cookies but can make URLs messy and has security implications if session IDs are exposed. [PAUSE=1.5s] It's important to understand that while these mechanisms introduce statefulness from a user's perspective, they don't fundamentally change HTTP's stateless core. They are layers built on top of HTTP to provide the rich, interactive, and personalized experiences we've come to expect from the modern web, effectively bridging the gap between a stateless protocol and stateful applications. [PAUSE=1s] However, these solutions do add complexity, and managing state correctly is a significant part of web development. [PAUSE=8s] In summary, HTTP is stateless by its very design. This fundamental architectural choice was made to ensure the internet could achieve [PAUSE=0.5s] massive scalability, [PAUSE=0.5s] maintain elegant simplicity in server logic, and provide [PAUSE=0.5s] incredible resilience and fault tolerance across its vast, distributed network. [PAUSE=1s] While this means that servers don't natively remember individual interactions, ingenious mechanisms like cookies, server-side sessions, and, historically, URL rewriting, are cleverly built on top of HTTP. These layers allow for the personalized, interactive web experiences we all use daily. [PAUSE=1.5s] Understanding this core principle helps demystify how the internet truly functions, showcasing a brilliant engineering trade-off that prioritizes robustness and reach over inherent memory. It's the silent, powerful engine behind your every click and scroll.",
  "scenes": [
    {
      "id": "scene-1",
      "baseDuration": 35,
      "holdDuration": 5,
      "narration": "Hey everyone, and welcome back! Today, we're unraveling a core concept behind how the internet works: Why is HTTP stateless? [PAUSE=1s] HTTP, or the Hypertext Transfer Protocol, is the language your web browser uses to communicate with servers. Every time you click a link, type a URL, or submit a form, an HTTP request is sent from your client to a server, and the server sends back a response. [PAUSE=1s] Now, 'stateless' means that each of these requests is completely independent. The server processes it without any inherent memory or knowledge of previous requests from the same user. [PAUSE=1s] It's like calling a customer service line, where each new call starts fresh, without the agent remembering your last conversation unless you explicitly tell them everything again. So, why was it designed this way, and what are the profound implications for how the web functions today?",
      "actions": [
        {
          "t": 0.5,
          "op": "rect",
          "x": 100,
          "y": 300,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 1,
          "op": "text",
          "x": 140,
          "y": 350,
          "value": "Browser"
        },
        {
          "t": 1.5,
          "op": "rect",
          "x": 980,
          "y": 300,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 2,
          "op": "text",
          "x": 1020,
          "y": 350,
          "value": "Server"
        },
        {
          "t": 3,
          "op": "line",
          "x1": 300,
          "y1": 360,
          "x2": 980,
          "y2": 360
        },
        {
          "t": 3.5,
          "op": "text",
          "x": 600,
          "y": 330,
          "value": "HTTP Request"
        },
        {
          "t": 7,
          "op": "text",
          "x": 640,
          "y": 80,
          "value": "What is HTTP Stateless?"
        },
        {
          "t": 18,
          "op": "text",
          "x": 350,
          "y": 200,
          "value": "Request 1 (Independent)"
        },
        {
          "t": 20,
          "op": "text",
          "x": 350,
          "y": 480,
          "value": "Request 2 (Independent)"
        },
        {
          "t": 22,
          "op": "line",
          "x1": 300,
          "y1": 360,
          "x2": 980,
          "y2": 360
        },
        {
          "t": 22.5,
          "op": "line",
          "x1": 300,
          "y1": 500,
          "x2": 980,
          "y2": 500
        },
        {
          "t": 24,
          "op": "text",
          "x": 640,
          "y": 600,
          "value": "No Memory of Past Interactions"
        }
      ]
    },
    {
      "id": "scene-2",
      "baseDuration": 35,
      "holdDuration": 5,
      "narration": "To truly grasp statelessness, let's think about a straightforward real-world example: [PAUSE=0.7s] a vending machine. When you walk up to a vending machine, your interaction is simple: you insert your money, press a button corresponding to your desired snack, and receive it. [PAUSE=1s] If you decide you want another snack, you have to repeat the entire process: insert money, press the button again. The machine itself doesn't 'remember' that you just bought something, nor does it keep a running tab or hold onto your change for a future purchase. [PAUSE=1s] Each transaction is a complete, standalone event. This independence, where no past interaction influences the current one, perfectly illustrates the core principle of HTTP's stateless nature. Every request your browser sends to a server is treated with this same 'fresh start' mentality.",
      "actions": [
        {
          "t": 0.5,
          "op": "rect",
          "x": 500,
          "y": 150,
          "w": 280,
          "h": 400,
          "r": 20
        },
        {
          "t": 1,
          "op": "rect",
          "x": 520,
          "y": 170,
          "w": 240,
          "h": 180
        },
        {
          "t": 1.5,
          "op": "text",
          "x": 580,
          "y": 250,
          "value": "Snacks Here"
        },
        {
          "t": 2,
          "op": "rect",
          "x": 580,
          "y": 380,
          "w": 120,
          "h": 40,
          "r": 5
        },
        {
          "t": 2.5,
          "op": "text",
          "x": 600,
          "y": 395,
          "value": "Button A1"
        },
        {
          "t": 3,
          "op": "ellipse",
          "cx": 550,
          "cy": 450,
          "rx": 20,
          "ry": 20
        },
        {
          "t": 3.5,
          "op": "text",
          "x": 535,
          "y": 440,
          "value": "$"
        },
        {
          "t": 4,
          "op": "line",
          "x1": 550,
          "y1": 470,
          "x2": 550,
          "y2": 500
        },
        {
          "t": 4.5,
          "op": "text",
          "x": 510,
          "y": 520,
          "value": "Coin Slot"
        },
        {
          "t": 8,
          "op": "ellipse",
          "cx": 550,
          "cy": 450,
          "rx": 20,
          "ry": 20
        },
        {
          "t": 8.5,
          "op": "text",
          "x": 535,
          "y": 440,
          "value": "$"
        },
        {
          "t": 9,
          "op": "line",
          "x1": 550,
          "y1": 470,
          "x2": 550,
          "y2": 500
        },
        {
          "t": 10,
          "op": "rect",
          "x": 580,
          "y": 380,
          "w": 120,
          "h": 40,
          "r": 5
        },
        {
          "t": 10.5,
          "op": "text",
          "x": 600,
          "y": 395,
          "value": "Button A1"
        },
        {
          "t": 11.5,
          "op": "rect",
          "x": 520,
          "y": 560,
          "w": 240,
          "h": 40
        },
        {
          "t": 12,
          "op": "text",
          "x": 580,
          "y": 575,
          "value": "Snack Dispensed"
        },
        {
          "t": 16,
          "op": "text",
          "x": 640,
          "y": 80,
          "value": "Stateless Vending Machine Analogy"
        },
        {
          "t": 20,
          "op": "rect",
          "x": 500,
          "y": 150,
          "w": 280,
          "h": 400,
          "r": 20,
          "stroke": "blue",
          "stroke-width": 5
        },
        {
          "t": 21,
          "op": "text",
          "x": 640,
          "y": 620,
          "value": "Each Transaction is Independent"
        }
      ]
    },
    {
      "id": "scene-3",
      "baseDuration": 55,
      "holdDuration": 5,
      "narration": "So, why adopt such a seemingly forgetful design? The primary, and perhaps most critical, reason is [excited] massive scalability! [PAUSE=1s] Think about websites like Google, Amazon, or Facebook. They handle billions, even trillions, of requests from users around the globe every single day. If each server had to maintain a persistent 'state' for every single active user—remembering their exact location on the site, their shopping cart contents, their last search query—the memory and processing requirements would quickly become astronomical and highly inefficient. [PAUSE=1.5s] With stateless HTTP, any server can handle any request at any time. A sophisticated load balancer can efficiently distribute incoming requests across a vast farm of servers. It doesn't matter which specific server gets your request, because no server holds unique, user-specific information that others don't. This 'share nothing' architecture means adding more servers to handle increased traffic is incredibly straightforward and cost-effective, allowing the web to grow almost infinitely.",
      "actions": [
        {
          "t": 0.5,
          "op": "text",
          "x": 640,
          "y": 80,
          "value": "Benefit 1: Massive Scalability"
        },
        {
          "t": 2,
          "op": "rect",
          "x": 540,
          "y": 200,
          "w": 200,
          "h": 80,
          "r": 10
        },
        {
          "t": 2.5,
          "op": "text",
          "x": 580,
          "y": 230,
          "value": "Client Request"
        },
        {
          "t": 4,
          "op": "rect",
          "x": 590,
          "y": 320,
          "w": 100,
          "h": 40,
          "r": 5
        },
        {
          "t": 4.5,
          "op": "text",
          "x": 600,
          "y": 335,
          "value": "Load Balancer"
        },
        {
          "t": 5,
          "op": "line",
          "x1": 640,
          "y1": 280,
          "x2": 640,
          "y2": 320
        },
        {
          "t": 6,
          "op": "rect",
          "x": 100,
          "y": 450,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 6.5,
          "op": "text",
          "x": 140,
          "y": 500,
          "value": "Server A"
        },
        {
          "t": 7,
          "op": "rect",
          "x": 400,
          "y": 450,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 7.5,
          "op": "text",
          "x": 440,
          "y": 500,
          "value": "Server B"
        },
        {
          "t": 8,
          "op": "rect",
          "x": 700,
          "y": 450,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 8.5,
          "op": "text",
          "x": 740,
          "y": 500,
          "value": "Server C"
        },
        {
          "t": 9,
          "op": "rect",
          "x": 1000,
          "y": 450,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 9.5,
          "op": "text",
          "x": 1040,
          "y": 500,
          "value": "Server D"
        },
        {
          "t": 10,
          "op": "line",
          "x1": 640,
          "y1": 360,
          "x2": 200,
          "y2": 450
        },
        {
          "t": 10.5,
          "op": "line",
          "x1": 640,
          "y1": 360,
          "x2": 500,
          "y2": 450
        },
        {
          "t": 11,
          "op": "line",
          "x1": 640,
          "y1": 360,
          "x2": 800,
          "y2": 450
        },
        {
          "t": 11.5,
          "op": "line",
          "x1": 640,
          "y1": 360,
          "x2": 1100,
          "y2": 450
        },
        {
          "t": 20,
          "op": "text",
          "x": 640,
          "y": 620,
          "value": "No Server Holds Unique User State"
        },
        {
          "t": 25,
          "op": "rect",
          "x": 100,
          "y": 450,
          "w": 200,
          "h": 120,
          "r": 10,
          "stroke": "green",
          "stroke-width": 3
        },
        {
          "t": 25.5,
          "op": "rect",
          "x": 400,
          "y": 450,
          "w": 200,
          "h": 120,
          "r": 10,
          "stroke": "green",
          "stroke-width": 3
        },
        {
          "t": 26,
          "op": "rect",
          "x": 700,
          "y": 450,
          "w": 200,
          "h": 120,
          "r": 10,
          "stroke": "green",
          "stroke-width": 3
        },
        {
          "t": 26.5,
          "op": "rect",
          "x": 1000,
          "y": 450,
          "w": 200,
          "h": 120,
          "r": 10,
          "stroke": "green",
          "stroke-width": 3
        },
        {
          "t": 30,
          "op": "rect",
          "x": 100,
          "y": 450,
          "w": 200,
          "h": 120,
          "r": 10,
          "stroke": "blue",
          "stroke-width": 5
        },
        {
          "t": 30.5,
          "op": "text",
          "x": 140,
          "y": 500,
          "value": "New Server E"
        },
        {
          "t": 31,
          "op": "line",
          "x1": 640,
          "y1": 360,
          "x2": 200,
          "y2": 450
        }
      ]
    },
    {
      "id": "scene-4",
      "baseDuration": 55,
      "holdDuration": 5,
      "narration": "Beyond just scalability, statelessness brings significant advantages in terms of simplicity and resilience. [PAUSE=1s] From a server's perspective, the logic becomes far less complex. It doesn't need intricate mechanisms to manage, store, or synchronize user sessions across potentially hundreds or thousands of machines. Each request is processed, a response is sent, and then the server can forget about it, freeing up resources immediately. [PAUSE=1.5s] This simplifies server design and development tremendously. [PAUSE=1s] And for resilience, if a server unexpectedly crashes or goes offline, it's not a catastrophic event for user data. No persistent, user-specific state is lost from that specific machine because it wasn't storing any unique information to begin with. The very next request from the user can simply be routed by the load balancer to any other available server, and everything continues as normal. This makes the web incredibly robust and fault-tolerant, drastically reducing downtime and improving overall reliability.",
      "actions": [
        {
          "t": 0.5,
          "op": "text",
          "x": 640,
          "y": 80,
          "value": "Benefits: Simplicity & Resilience"
        },
        {
          "t": 2,
          "op": "rect",
          "x": 540,
          "y": 250,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 2.5,
          "op": "text",
          "x": 580,
          "y": 300,
          "value": "Server Logic"
        },
        {
          "t": 3,
          "op": "rect",
          "x": 480,
          "y": 400,
          "w": 320,
          "h": 80,
          "r": 5
        },
        {
          "t": 3.5,
          "op": "text",
          "x": 500,
          "y": 430,
          "value": "No Complex Session Management"
        },
        {
          "t": 10,
          "op": "rect",
          "x": 200,
          "y": 450,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 10.5,
          "op": "text",
          "x": 240,
          "y": 500,
          "value": "Server 1"
        },
        {
          "t": 11,
          "op": "rect",
          "x": 880,
          "y": 450,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 11.5,
          "op": "text",
          "x": 920,
          "y": 500,
          "value": "Server 2"
        },
        {
          "t": 13,
          "op": "line",
          "x1": 400,
          "y1": 510,
          "x2": 880,
          "y2": 510
        },
        {
          "t": 14,
          "op": "rect",
          "x": 200,
          "y": 450,
          "w": 200,
          "h": 120,
          "r": 10,
          "stroke": "red",
          "stroke-width": 5
        },
        {
          "t": 15,
          "op": "text",
          "x": 240,
          "y": 500,
          "value": "CRASHED!"
        },
        {
          "t": 16,
          "op": "line",
          "x1": 50,
          "y1": 510,
          "x2": 880,
          "y2": 510,
          "stroke": "green",
          "stroke-width": 3
        },
        {
          "t": 20,
          "op": "text",
          "x": 640,
          "y": 620,
          "value": "Fault-Tolerant System"
        }
      ]
    },
    {
      "id": "scene-5",
      "baseDuration": 55,
      "holdDuration": 5,
      "narration": "Okay, so HTTP is stateless. But then, how do websites manage to remember my login status, the items in my shopping cart, or my personalized preferences across different pages and visits? [PAUSE=1s] This is where client-side mechanisms come into play, primarily through small data packets called 'cookies'. When you log into a website, for instance, the server verifies your credentials and then sends a small piece of data—a cookie—back to your browser. Your browser then stores this cookie locally. [PAUSE=1.5s] Crucially, with every subsequent request you make to that same website, your browser automatically includes and sends that stored cookie back to the server. The server can then read this cookie, identify you (often by a unique session ID stored within the cookie), and retrieve your specific state from its own persistent storage, like a database. [PAUSE=1s] So, it's the client reminding the server about your identity and past interactions, rather than the server trying to remember on its own between requests. This clever offloading of responsibility is key.",
      "actions": [
        {
          "t": 0.5,
          "op": "text",
          "x": 640,
          "y": 80,
          "value": "How Websites \"Remember\": Cookies"
        },
        {
          "t": 2,
          "op": "rect",
          "x": 100,
          "y": 300,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 2.5,
          "op": "text",
          "x": 140,
          "y": 350,
          "value": "Browser"
        },
        {
          "t": 3,
          "op": "rect",
          "x": 980,
          "y": 300,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 3.5,
          "op": "text",
          "x": 1020,
          "y": 350,
          "value": "Server"
        },
        {
          "t": 4,
          "op": "line",
          "x1": 300,
          "y1": 360,
          "x2": 980,
          "y2": 360
        },
        {
          "t": 4.5,
          "op": "text",
          "x": 600,
          "y": 330,
          "value": "Login Request"
        },
        {
          "t": 10,
          "op": "ellipse",
          "cx": 640,
          "cy": 450,
          "rx": 80,
          "ry": 40
        },
        {
          "t": 10.5,
          "op": "text",
          "x": 610,
          "y": 440,
          "value": "Cookie"
        },
        {
          "t": 11,
          "op": "line",
          "x1": 980,
          "y1": 380,
          "x2": 720,
          "y2": 450
        },
        {
          "t": 11.5,
          "op": "line",
          "x1": 720,
          "y1": 450,
          "x2": 300,
          "y2": 380
        },
        {
          "t": 15,
          "op": "line",
          "x1": 300,
          "y1": 360,
          "x2": 980,
          "y2": 360
        },
        {
          "t": 15.5,
          "op": "text",
          "x": 600,
          "y": 330,
          "value": "Next Request (with Cookie)"
        },
        {
          "t": 16,
          "op": "ellipse",
          "cx": 250,
          "cy": 450,
          "rx": 80,
          "ry": 40
        },
        {
          "t": 16.5,
          "op": "text",
          "x": 220,
          "y": 440,
          "value": "Cookie"
        },
        {
          "t": 17,
          "op": "line",
          "x1": 300,
          "y1": 380,
          "x2": 250,
          "y2": 450
        },
        {
          "t": 18,
          "op": "line",
          "x1": 250,
          "y1": 450,
          "x2": 600,
          "y2": 330
        },
        {
          "t": 20,
          "op": "rect",
          "x": 900,
          "y": 500,
          "w": 150,
          "h": 100,
          "r": 10
        },
        {
          "t": 20.5,
          "op": "text",
          "x": 920,
          "y": 540,
          "value": "Database"
        },
        {
          "t": 22,
          "op": "line",
          "x1": 980,
          "y1": 380,
          "x2": 970,
          "y2": 500
        },
        {
          "t": 24,
          "op": "text",
          "x": 640,
          "y": 620,
          "value": "Client-Side State Management"
        }
      ]
    },
    {
      "id": "scene-6",
      "baseDuration": 60,
      "holdDuration": 5,
      "narration": "While cookies are the most prevalent, other methods exist to manage state in a stateless HTTP environment. [PAUSE=0.7s] Server-side sessions are common: a unique session ID is stored in a cookie, but the actual, larger user data is kept on the server's memory or a dedicated session store. This means less data is transmitted with each request, which can be more secure and efficient for complex data. [PAUSE=1s] Another, though less common today, is URL rewriting, where session IDs or even small pieces of data are embedded directly into the URL itself. This works without cookies but can make URLs messy and has security implications if session IDs are exposed. [PAUSE=1.5s] It's important to understand that while these mechanisms *introduce* statefulness from a user's perspective, they don't fundamentally change HTTP's stateless core. They are layers built *on top of* HTTP to provide the rich, interactive, and personalized experiences we've come to expect from the modern web, effectively bridging the gap between a stateless protocol and stateful applications. [PAUSE=1s] However, these solutions do add complexity, and managing state correctly is a significant part of web development.",
      "actions": [
        {
          "t": 0.5,
          "op": "text",
          "x": 640,
          "y": 80,
          "value": "Other State Management & Trade-offs"
        },
        {
          "t": 2,
          "op": "rect",
          "x": 100,
          "y": 300,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 2.5,
          "op": "text",
          "x": 140,
          "y": 350,
          "value": "Browser"
        },
        {
          "t": 3,
          "op": "rect",
          "x": 980,
          "y": 300,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 3.5,
          "op": "text",
          "x": 1020,
          "y": 350,
          "value": "Server"
        },
        {
          "t": 4,
          "op": "line",
          "x1": 300,
          "y1": 360,
          "x2": 980,
          "y2": 360
        },
        {
          "t": 4.5,
          "op": "text",
          "x": 600,
          "y": 330,
          "value": "Request (Session ID)"
        },
        {
          "t": 6,
          "op": "rect",
          "x": 700,
          "y": 450,
          "w": 150,
          "h": 100,
          "r": 10
        },
        {
          "t": 6.5,
          "op": "text",
          "x": 720,
          "y": 490,
          "value": "Session Store"
        },
        {
          "t": 7,
          "op": "line",
          "x1": 980,
          "y1": 360,
          "x2": 850,
          "y2": 490
        },
        {
          "t": 7.5,
          "op": "line",
          "x1": 850,
          "y1": 490,
          "x2": 980,
          "y2": 360
        },
        {
          "t": 12,
          "op": "rect",
          "x": 50,
          "y": 580,
          "w": 500,
          "h": 50,
          "r": 5
        },
        {
          "t": 12.5,
          "op": "text",
          "x": 70,
          "y": 600,
          "value": "example.com/page?sessionid=12345"
        },
        {
          "t": 14,
          "op": "text",
          "x": 280,
          "y": 550,
          "value": "URL Rewriting"
        },
        {
          "t": 18,
          "op": "rect",
          "x": 500,
          "y": 200,
          "w": 280,
          "h": 100,
          "r": 10
        },
        {
          "t": 18.5,
          "op": "text",
          "x": 540,
          "y": 240,
          "value": "HTTP (Stateless Core)"
        },
        {
          "t": 20,
          "op": "line",
          "x1": 640,
          "y1": 300,
          "x2": 640,
          "y2": 380
        },
        {
          "t": 20.5,
          "op": "text",
          "x": 600,
          "y": 360,
          "value": "State Layers:"
        },
        {
          "t": 22,
          "op": "rect",
          "x": 200,
          "y": 450,
          "w": 120,
          "h": 60,
          "r": 5
        },
        {
          "t": 22.5,
          "op": "text",
          "x": 220,
          "y": 470,
          "value": "Cookies"
        },
        {
          "t": 23,
          "op": "rect",
          "x": 480,
          "y": 450,
          "w": 120,
          "h": 60,
          "r": 5
        },
        {
          "t": 23.5,
          "op": "text",
          "x": 500,
          "y": 470,
          "value": "Sessions"
        },
        {
          "t": 24,
          "op": "rect",
          "x": 760,
          "y": 450,
          "w": 120,
          "h": 60,
          "r": 5
        },
        {
          "t": 24.5,
          "op": "text",
          "x": 780,
          "y": 470,
          "value": "URL Rewriting"
        }
      ]
    },
    {
      "id": "scene-7",
      "baseDuration": 50,
      "holdDuration": 5,
      "narration": "In summary, HTTP is stateless by its very design. This fundamental architectural choice was made to ensure the internet could achieve [PAUSE=0.5s] massive scalability, [PAUSE=0.5s] maintain elegant simplicity in server logic, and provide [PAUSE=0.5s] incredible resilience and fault tolerance across its vast, distributed network. [PAUSE=1s] While this means that servers don't natively remember individual interactions, ingenious mechanisms like cookies, server-side sessions, and, historically, URL rewriting, are cleverly built on top of HTTP. These layers allow for the personalized, interactive web experiences we all use daily. [PAUSE=1.5s] Understanding this core principle helps demystify how the internet truly functions, showcasing a brilliant engineering trade-off that prioritizes robustness and reach over inherent memory. It's the silent, powerful engine behind your every click and scroll.",
      "actions": [
        {
          "t": 0.5,
          "op": "text",
          "x": 640,
          "y": 80,
          "value": "Recap: Why HTTP is Stateless"
        },
        {
          "t": 2,
          "op": "rect",
          "x": 100,
          "y": 200,
          "w": 280,
          "h": 100,
          "r": 10
        },
        {
          "t": 2.5,
          "op": "text",
          "x": 140,
          "y": 240,
          "value": "Scalability"
        },
        {
          "t": 3,
          "op": "rect",
          "x": 500,
          "y": 200,
          "w": 280,
          "h": 100,
          "r": 10
        },
        {
          "t": 3.5,
          "op": "text",
          "x": 540,
          "y": 240,
          "value": "Simplicity"
        },
        {
          "t": 4,
          "op": "rect",
          "x": 900,
          "y": 200,
          "w": 280,
          "h": 100,
          "r": 10
        },
        {
          "t": 4.5,
          "op": "text",
          "x": 940,
          "y": 240,
          "value": "Resilience"
        },
        {
          "t": 8,
          "op": "line",
          "x1": 640,
          "y1": 320,
          "x2": 640,
          "y2": 400
        },
        {
          "t": 8.5,
          "op": "text",
          "x": 600,
          "y": 360,
          "value": "Built On Top:"
        },
        {
          "t": 10,
          "op": "rect",
          "x": 100,
          "y": 450,
          "w": 280,
          "h": 80,
          "r": 10
        },
        {
          "t": 10.5,
          "op": "text",
          "x": 140,
          "y": 480,
          "value": "Cookies"
        },
        {
          "t": 11,
          "op": "rect",
          "x": 500,
          "y": 450,
          "w": 280,
          "h": 80,
          "r": 10
        },
        {
          "t": 11.5,
          "op": "text",
          "x": 540,
          "y": 480,
          "value": "Sessions"
        },
        {
          "t": 12,
          "op": "rect",
          "x": 900,
          "y": 450,
          "w": 280,
          "h": 80,
          "r": 10
        },
        {
          "t": 12.5,
          "op": "text",
          "x": 940,
          "y": 480,
          "value": "URL Rewriting"
        },
        {
          "t": 20,
          "op": "text",
          "x": 640,
          "y": 600,
          "value": "The Robust Web Architecture"
        }
      ]
    }
  ],
  "shorts": [
    {
      "id": "short-1",
      "hook": "Why does the internet forget who you are?",
      "narration": "Ever noticed how websites seem to 'forget' you sometimes? That's because HTTP, the language of the web, is fundamentally stateless. Each request your browser sends to a server is treated as completely new. It's like a vending machine: every time you want a snack, you start fresh, no memory of your last purchase! This design choice is crucial for the web's massive scalability and incredible resilience. It's how the internet handles billions of users simultaneously!",
      "baseDuration": 25,
      "actions": [
        {
          "t": 0.5,
          "op": "text",
          "x": 360,
          "y": 100,
          "value": "HTTP is Stateless!"
        },
        {
          "t": 2,
          "op": "rect",
          "x": 100,
          "y": 300,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 2.5,
          "op": "text",
          "x": 140,
          "y": 350,
          "value": "Browser"
        },
        {
          "t": 3,
          "op": "rect",
          "x": 420,
          "y": 300,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 3.5,
          "op": "text",
          "x": 460,
          "y": 350,
          "value": "Server"
        },
        {
          "t": 4,
          "op": "line",
          "x1": 300,
          "y1": 360,
          "x2": 420,
          "y2": 360
        },
        {
          "t": 4.5,
          "op": "text",
          "x": 360,
          "y": 330,
          "value": "Request 1"
        },
        {
          "t": 7,
          "op": "line",
          "x1": 300,
          "y1": 460,
          "x2": 420,
          "y2": 460
        },
        {
          "t": 7.5,
          "op": "text",
          "x": 360,
          "y": 430,
          "value": "Request 2 (New!)"
        },
        {
          "t": 10,
          "op": "rect",
          "x": 220,
          "y": 600,
          "w": 280,
          "h": 400,
          "r": 20
        },
        {
          "t": 10.5,
          "op": "rect",
          "x": 240,
          "y": 620,
          "w": 240,
          "h": 180
        },
        {
          "t": 11,
          "op": "text",
          "x": 300,
          "y": 700,
          "value": "Snacks"
        },
        {
          "t": 12,
          "op": "ellipse",
          "cx": 270,
          "cy": 850,
          "rx": 20,
          "ry": 20
        },
        {
          "t": 12.5,
          "op": "text",
          "x": 260,
          "y": 840,
          "value": "$"
        },
        {
          "t": 13,
          "op": "rect",
          "x": 320,
          "y": 870,
          "w": 80,
          "h": 30,
          "r": 5
        },
        {
          "t": 13.5,
          "op": "text",
          "x": 330,
          "y": 880,
          "value": "Button"
        },
        {
          "t": 16,
          "op": "text",
          "x": 360,
          "y": 1100,
          "value": "Scalability & Resilience"
        }
      ]
    },
    {
      "id": "short-2",
      "hook": "How does Google handle millions of users at once?",
      "narration": "The secret to how massive websites like Google or Facebook handle billions of requests is HTTP's stateless design. Because each request is independent, any server can handle it. This means you can add hundreds or thousands of servers, and a load balancer simply distributes the incoming requests. If one server gets busy or even fails, another can instantly take over because no specific user data is tied to any single machine. It's incredibly efficient for scaling and ensures the web stays robust and available!",
      "baseDuration": 25,
      "actions": [
        {
          "t": 0.5,
          "op": "text",
          "x": 360,
          "y": 100,
          "value": "HTTP's Scalability Power!"
        },
        {
          "t": 2,
          "op": "rect",
          "x": 260,
          "y": 200,
          "w": 200,
          "h": 80,
          "r": 10
        },
        {
          "t": 2.5,
          "op": "text",
          "x": 300,
          "y": 230,
          "value": "User Request"
        },
        {
          "t": 4,
          "op": "rect",
          "x": 310,
          "y": 320,
          "w": 100,
          "h": 40,
          "r": 5
        },
        {
          "t": 4.5,
          "op": "text",
          "x": 320,
          "y": 335,
          "value": "Load Balancer"
        },
        {
          "t": 5,
          "op": "line",
          "x1": 360,
          "y1": 280,
          "x2": 360,
          "y2": 320
        },
        {
          "t": 6,
          "op": "rect",
          "x": 100,
          "y": 450,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 6.5,
          "op": "text",
          "x": 140,
          "y": 500,
          "value": "Server A"
        },
        {
          "t": 7,
          "op": "rect",
          "x": 420,
          "y": 450,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 7.5,
          "op": "text",
          "x": 460,
          "y": 500,
          "value": "Server B"
        },
        {
          "t": 8,
          "op": "rect",
          "x": 100,
          "y": 650,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 8.5,
          "op": "text",
          "x": 140,
          "y": 700,
          "value": "Server C"
        },
        {
          "t": 9,
          "op": "rect",
          "x": 420,
          "y": 650,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 9.5,
          "op": "text",
          "x": 460,
          "y": 700,
          "value": "Server D"
        },
        {
          "t": 10,
          "op": "line",
          "x1": 360,
          "y1": 360,
          "x2": 200,
          "y2": 450
        },
        {
          "t": 10.5,
          "op": "line",
          "x1": 360,
          "y1": 360,
          "x2": 520,
          "y2": 450
        },
        {
          "t": 11,
          "op": "line",
          "x1": 360,
          "y1": 360,
          "x2": 200,
          "y2": 650
        },
        {
          "t": 11.5,
          "op": "line",
          "x1": 360,
          "y1": 360,
          "x2": 520,
          "y2": 650
        },
        {
          "t": 18,
          "op": "rect",
          "x": 100,
          "y": 450,
          "w": 200,
          "h": 120,
          "r": 10,
          "stroke": "red",
          "stroke-width": 5
        },
        {
          "t": 19,
          "op": "line",
          "x1": 360,
          "y1": 360,
          "x2": 520,
          "y2": 450,
          "stroke": "green",
          "stroke-width": 3
        },
        {
          "t": 19.5,
          "op": "line",
          "x1": 360,
          "y1": 360,
          "x2": 200,
          "y2": 650,
          "stroke": "green",
          "stroke-width": 3
        },
        {
          "t": 20,
          "op": "line",
          "x1": 360,
          "y1": 360,
          "x2": 520,
          "y2": 650,
          "stroke": "green",
          "stroke-width": 3
        }
      ]
    },
    {
      "id": "short-3",
      "hook": "How do websites remember your login?",
      "narration": "Even though HTTP is stateless, websites skillfully manage to 'remember' who you are. The most common way is through cookies! When you log in, the server sends a small data packet, a cookie, to your browser. Your browser then stores this cookie and automatically sends it back with every subsequent request to that site. The server reads the cookie, identifies you, and retrieves your personalized information from its own storage. It's the client reminding the server, allowing for a seamless, personalized experience on a stateless foundation. This offloading of memory makes the web incredibly efficient!",
      "baseDuration": 25,
      "actions": [
        {
          "t": 0.5,
          "op": "text",
          "x": 360,
          "y": 100,
          "value": "Cookies: Your Web Memory!"
        },
        {
          "t": 2,
          "op": "rect",
          "x": 100,
          "y": 300,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 2.5,
          "op": "text",
          "x": 140,
          "y": 350,
          "value": "Browser"
        },
        {
          "t": 3,
          "op": "rect",
          "x": 420,
          "y": 300,
          "w": 200,
          "h": 120,
          "r": 10
        },
        {
          "t": 3.5,
          "op": "text",
          "x": 460,
          "y": 350,
          "value": "Server"
        },
        {
          "t": 4,
          "op": "line",
          "x1": 300,
          "y1": 360,
          "x2": 420,
          "y2": 360
        },
        {
          "t": 4.5,
          "op": "text",
          "x": 360,
          "y": 330,
          "value": "Login Request"
        },
        {
          "t": 9,
          "op": "ellipse",
          "cx": 360,
          "cy": 480,
          "rx": 100,
          "ry": 50
        },
        {
          "t": 9.5,
          "op": "text",
          "x": 330,
          "y": 470,
          "value": "Cookie"
        },
        {
          "t": 10,
          "op": "line",
          "x1": 420,
          "y1": 380,
          "x2": 360,
          "y2": 480
        },
        {
          "t": 10.5,
          "op": "line",
          "x1": 360,
          "y1": 480,
          "x2": 300,
          "y2": 380
        },
        {
          "t": 13,
          "op": "line",
          "x1": 300,
          "y1": 360,
          "x2": 420,
          "y2": 360
        },
        {
          "t": 13.5,
          "op": "text",
          "x": 360,
          "y": 330,
          "value": "Next Request (with Cookie)"
        },
        {
          "t": 14,
          "op": "ellipse",
          "cx": 200,
          "cy": 480,
          "rx": 100,
          "ry": 50
        },
        {
          "t": 14.5,
          "op": "text",
          "x": 170,
          "y": 470,
          "value": "Cookie"
        },
        {
          "t": 15,
          "op": "line",
          "x1": 300,
          "y1": 380,
          "x2": 200,
          "y2": 480
        },
        {
          "t": 16,
          "op": "line",
          "x1": 200,
          "y1": 480,
          "x2": 360,
          "y2": 330
        },
        {
          "t": 18,
          "op": "rect",
          "x": 450,
          "y": 550,
          "w": 150,
          "h": 100,
          "r": 10
        },
        {
          "t": 18.5,
          "op": "text",
          "x": 470,
          "y": 590,
          "value": "Database"
        },
        {
          "t": 19,
          "op": "line",
          "x1": 420,
          "y1": 380,
          "x2": 470,
          "y2": 550
        }
      ]
    }
  ]
}