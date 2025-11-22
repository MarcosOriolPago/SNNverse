
export const C = {
    colors: {
      primary: '#AF00FF',
      secondary: '#2E2E2E',
      accent: '#4E4E4E',
      text: '#FFFFFF',
      textSecondary: '#A0A0A0',
      highlight: '#6E6E6E',
    },
    spacing: {
      small: '8px',
      medium: '16px',
      large: '24px',
    },
    fontSize: {
      small: '12px',
      medium: '14px',
      large: '16px',
    },
    borderRadius: {
      small: '4px',
      medium: '8px',
      large: '12px',
    },
    boxShadow: {
      small: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      medium: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      large: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    },
    button: {
      base: 'font-bold py-2 px-4 rounded',
      primary: 'bg-blue-500 hover:bg-blue-700 text-white',
      secondary: 'bg-gray-500 hover:bg-gray-700 text-white',
    },
  };

export const STYLES = {

    // GENERIC
    mainContent: `flex-1 relative h-screen bg-[${C.colors.primary}] transition-all duration-300 ease-in-out`,


    // SIDEBAR
    sidebar : {
        main: `fixed top-0 left-0 h-full bg-[${C.colors.secondary}] ${C.boxShadow.large} p-3 transition-width duration-300 ease-in-out z-20 flex flex-col`,
        header: "h-16 mb-6 flex items-center justify-center",
        snnverse_h1_title: `text-3xl text-[#FFFFFF] font-extrabold font-mono tracking-wider drop-shadow-lg`
    },

    // SIDEBAR LIBRARY
    library : {
        library_title_entry: `text-xs font-bold text-[#A0A0A0] uppercase mb-2`,
        module_entry: `border rounded-lg p-4`,
    },


    // BUTTONS
    buttons: {
        toggle_open_close_lateral_bar: `absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 p-2 rounded-full border bg-[#2E2E2E] hover:bg-[#6E6E6E] ${C.boxShadow.medium}`,

    }
} 
